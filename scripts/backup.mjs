import { backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';

const source = resolve(process.env.DATABASE_FILE || resolve(process.env.DATA_DIR || './data', 'sales.sqlite'));
const destinationDir = resolve(process.env.BACKUP_DIR || './backups');
if (!existsSync(source)) throw new Error(`Database not found: ${source}`);
if (destinationDir === source || source.startsWith(`${destinationDir}/`) || source.startsWith(`${destinationDir}\\`)) {
  throw new Error('The backup directory must not contain the source database.');
}
mkdirSync(destinationDir, { recursive: true });
const target = resolve(destinationDir, `sales-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}.sqlite`);
const db = openDatabase(source);
try {
  await backup(db, target);
  console.log(`SQLite backup created: ${target}`);
} finally {
  db.close();
}
