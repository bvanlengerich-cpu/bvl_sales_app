import { backup, DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function createSalesBackup({ databaseFile, dataDirectory, backupDirectory } = {}) {
  const dataDir = resolve(dataDirectory || process.env.DATA_DIR || './data');
  const source = resolve(databaseFile || process.env.DATABASE_FILE || resolve(dataDir, 'sales.sqlite'));
  const destinationDir = resolve(backupDirectory || process.env.BACKUP_DIR || './backups');
  if (!existsSync(source)) throw new Error(`Database not found: ${source}`);
  const sourceWithinBackup = relative(destinationDir, source);
  if (destinationDir === source || (!isAbsolute(sourceWithinBackup) && !sourceWithinBackup.startsWith(`..${sep}`) && sourceWithinBackup !== '..')) throw new Error('The backup directory must not contain the source database.');
  await mkdir(destinationDir, { recursive: true });
  const name = `sales-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}`;
  const temporary = resolve(destinationDir, `${name}.partial`), target = resolve(destinationDir, name);
  await mkdir(temporary, { mode: 0o700 });
  let db;
  let snapshot;
  try {
    db = new DatabaseSync(source, { readOnly: true });
    const databaseTarget = resolve(temporary, 'sales.sqlite');
    await backup(db, databaseTarget);
    snapshot = new DatabaseSync(databaseTarget, { readOnly: true });
    const hasPhotos = snapshot.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='contact_photos'").get();
    const photos = hasPhotos ? snapshot.prepare('SELECT id,bytes,image_hash FROM contact_photos ORDER BY id').all() : [];
    if (photos.length) await mkdir(resolve(temporary, 'contact-photos'), { mode: 0o700 });
    for (const photo of photos) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(photo.id)) throw new Error('Invalid photo ID in database snapshot');
      let content;
      try { content = await readFile(resolve(dataDir, 'contact-photos', `${photo.id}.jpg`)); }
      catch { throw new Error(`Backup incomplete: photo ${photo.id} was removed or is missing. Please retry the backup.`); }
      if (content.length !== photo.bytes || createHash('sha256').update(content).digest('hex') !== photo.image_hash) throw new Error(`Backup incomplete: photo ${photo.id} failed its integrity check.`);
      await writeFile(resolve(temporary, 'contact-photos', `${photo.id}.jpg`), content, { flag: 'wx', mode: 0o600 });
    }
    snapshot.close(); snapshot = null;
    await writeFile(resolve(temporary, 'manifest.json'), JSON.stringify({ format: 'bvl-sales-backup-v1', createdAt: new Date().toISOString(), database: 'sales.sqlite', photoCount: photos.length }, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
    return { directory: target, database: resolve(target, 'sales.sqlite'), photoCount: photos.length };
  } catch (error) {
    snapshot?.close(); snapshot = null;
    // Only remove the exact partial directory created by this invocation.
    const check = relative(destinationDir, temporary);
    if (check && check !== '..' && !check.startsWith(`..${sep}`) && check === `${name}.partial`) await rm(temporary, { recursive: true, force: true });
    throw error;
  } finally { db?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await createSalesBackup();
  console.log(`Complete backup created: ${result.directory} (${result.photoCount} contact photos)`);
}
