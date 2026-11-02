import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { ContactError, contactPhotoMetadata, deleteContact, visibleContact } from './contacts.mjs';

export const MAX_CONTACT_PHOTOS = 2;
export const MAX_PHOTO_BYTES = 250 * 1024;
export const MAX_PHOTO_REQUEST_BYTES = 350 * 1024;
// Canonical lower-case IDs keep file and SQLite identities identical on both
// case-sensitive Linux and case-insensitive Windows filesystems.
const photoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const lanes = new WeakMap();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function checkPhotoId(id) {
  if (typeof id !== 'string' || !photoIdPattern.test(id)) throw new ContactError(400, 'Ungültige Foto-ID');
}

function requireContact(db, user, id) {
  const row = visibleContact(db, user, id);
  if (!row) throw new ContactError(404, 'Kontakt nicht gefunden');
  return row;
}

function photoLane(db, action) {
  const task = (lanes.get(db) || Promise.resolve()).then(action);
  lanes.set(db, task.catch(() => {}));
  return task;
}

export async function normalizePhoto(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_PHOTO_REQUEST_BYTES) throw new ContactError(413, 'Foto zu groß. Bitte zuerst verkleinern.');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ContactError(415, 'Bitte ein JPEG-Foto verwenden.');
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' }).metadata();
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || metadata.pages > 1) throw new Error('Ungültiges JPEG');
    for (const [size, quality] of [[1600, 80], [1600, 65], [1280, 65], [1024, 55]]) {
      // No withMetadata(): re-encoding deliberately strips EXIF, GPS and other
      // metadata. rotate() first applies the source orientation to the pixels.
      const output = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' }).rotate()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      if (output.data.length <= MAX_PHOTO_BYTES) return { bytes: output.data, width: output.info.width, height: output.info.height };
    }
    throw new ContactError(413, 'Foto lässt sich nicht ausreichend verkleinern.');
  } catch (error) {
    if (error instanceof ContactError) throw error;
    throw new ContactError(415, 'Das Foto konnte nicht gelesen werden. Bitte ein anderes JPEG verwenden.');
  }
}

export function createContactPhotos({ db, dataDir }) {
  const directory = resolve(dataDir, 'contact-photos');
  const file = id => { checkPhotoId(id); return resolve(directory, `${id}.jpg`); };

  async function cleanup() {
    for (const entry of db.prepare('SELECT id FROM contact_photo_cleanup').all()) {
      try { await unlink(file(entry.id)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      db.prepare('DELETE FROM contact_photo_cleanup WHERE id=?').run(entry.id);
    }
  }

  async function put(user, contactId, id, source) {
    checkPhotoId(id);
    requireContact(db, user, contactId);
    const sourceHash = digest(source);
    return photoLane(db, async () => {
      await cleanup();
      requireContact(db, user, contactId);
      const prior = db.prepare('SELECT * FROM contact_photos WHERE id=?').get(id);
      if (prior) {
        if (prior.contact_id !== contactId) throw new ContactError(404, 'Foto nicht gefunden');
        if (prior.source_hash !== sourceHash) throw new ContactError(409, 'Diese Foto-ID gehört bereits zu einem anderen Bild.');
        return { photo: contactPhotoMetadata(db, contactId).find(photo => photo.id === id) };
      }
      const removed = db.prepare('SELECT contact_id FROM contact_photo_tombstones WHERE id=?').get(id);
      if (removed) throw new ContactError(removed.contact_id === contactId ? 410 : 404, 'Dieses Foto wurde gelöscht.');
      if (db.prepare('SELECT COUNT(*) AS n FROM contact_photos WHERE contact_id=?').get(contactId).n >= MAX_CONTACT_PHOTOS) throw new ContactError(409, 'Pro Kontakt sind höchstens zwei Fotos möglich.');
      const normalized = await normalizePhoto(source);
      requireContact(db, user, contactId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      let createdFile = false;
      try {
        await writeFile(file(id), normalized.bytes, { flag: 'wx', mode: 0o600 });
        createdFile = true;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // A process may have stopped after writing the immutable file but
        // before committing metadata. Reuse only the exact canonical pixels.
        if (digest(await readFile(file(id))) !== digest(normalized.bytes)) throw new ContactError(409, 'Foto-ID bereits belegt.');
      }
      let transactionOpen = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        requireContact(db, user, contactId);
        if (db.prepare('SELECT 1 FROM contact_photo_tombstones WHERE id=?').get(id)) throw new ContactError(410, 'Dieses Foto wurde gelöscht.');
        const concurrent = db.prepare('SELECT contact_id,source_hash FROM contact_photos WHERE id=?').get(id);
        if (concurrent) {
          if (concurrent.contact_id !== contactId || concurrent.source_hash !== sourceHash) throw new ContactError(409, 'Foto-ID bereits belegt.');
          db.exec('COMMIT'); transactionOpen = false;
          return { photo: contactPhotoMetadata(db, contactId).find(photo => photo.id === id) };
        }
        if (db.prepare('SELECT COUNT(*) AS n FROM contact_photos WHERE contact_id=?').get(contactId).n >= MAX_CONTACT_PHOTOS) throw new ContactError(409, 'Pro Kontakt sind höchstens zwei Fotos möglich.');
        db.prepare('INSERT INTO contact_photos(id,contact_id,bytes,width,height,source_hash,image_hash,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(id, contactId, normalized.bytes.length, normalized.width, normalized.height, sourceHash, digest(normalized.bytes), new Date().toISOString());
        db.exec('COMMIT');
        transactionOpen = false;
      } catch (error) {
        if (transactionOpen) db.exec('ROLLBACK');
        if (createdFile && !db.prepare('SELECT 1 FROM contact_photos WHERE id=?').get(id)) await unlink(file(id)).catch(() => {});
        throw error;
      }
      return { photo: contactPhotoMetadata(db, contactId).find(photo => photo.id === id) };
    });
  }

  function get(user, contactId, id) {
    checkPhotoId(id);
    return photoLane(db, async () => {
      requireContact(db, user, contactId);
      const row = db.prepare('SELECT * FROM contact_photos WHERE id=? AND contact_id=?').get(id, contactId);
      if (!row) throw new ContactError(404, 'Foto nicht gefunden');
      const content = await readFile(file(id));
      requireContact(db, user, contactId);
      if (!db.prepare('SELECT 1 FROM contact_photos WHERE id=? AND contact_id=?').get(id, contactId)) throw new ContactError(404, 'Foto nicht gefunden');
      return content;
    });
  }

  function remove(user, contactId, id) {
    checkPhotoId(id);
    return photoLane(db, async () => {
      requireContact(db, user, contactId);
      const prior = db.prepare('SELECT contact_id FROM contact_photos WHERE id=?').get(id);
      const tombstone = db.prepare('SELECT contact_id FROM contact_photo_tombstones WHERE id=?').get(id);
      if ((prior && prior.contact_id !== contactId) || (tombstone && tombstone.contact_id !== contactId)) throw new ContactError(404, 'Foto nicht gefunden');
      if (!tombstone) {
        const stamp = new Date().toISOString();
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT OR IGNORE INTO contact_photo_tombstones(id,contact_id,deleted_at) VALUES (?,?,?)').run(id, contactId, stamp);
          if (prior) db.prepare('INSERT OR IGNORE INTO contact_photo_cleanup(id,contact_id,created_at) VALUES (?,?,?)').run(id, contactId, stamp);
          db.prepare('DELETE FROM contact_photos WHERE id=?').run(id);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      await cleanup();
      return { deletedPhotoId: id };
    });
  }

  function removeContact(user, contactId) {
    return photoLane(db, async () => {
      const response = deleteContact(db, user, contactId);
      await cleanup();
      return response;
    });
  }

  return { put, get, remove, removeContact, cleanup: () => photoLane(db, cleanup), directory };
}
