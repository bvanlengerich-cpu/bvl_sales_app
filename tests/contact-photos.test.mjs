import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';
import { createSalesBackup } from '../scripts/backup.mjs';

const ORIGIN = 'http://localhost:3000', PASSWORD = 'photo-test-password';
const data = { name: 'Visitenkarten-Test', fair: 'EuroTier', interests: [], requests: [], notes: '' };

function addUser(db, username, role) {
  const id = randomUUID(), time = new Date().toISOString();
  db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
    .run(id, username, username, hashPassword(PASSWORD), role, time, time);
  return id;
}

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'bvl-contact-photos-'));
  const db = openDatabase(join(directory, 'sales.sqlite'));
  for (const [name, role] of [['staff', 'staff'], ['other', 'staff'], ['admin', 'admin'], ['dealer', 'dealer']]) addUser(db, name, role);
  const { server } = createApp({ db, config: { PUBLIC_ORIGIN: ORIGIN, DATA_DIR: directory } });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', data: payload, raw, auth, csrf, origin = ORIGIN, contentType } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...((raw || payload !== undefined) ? { 'Content-Type': contentType || (raw ? 'image/jpeg' : 'application/json') } : {}),
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': csrf ?? auth.csrf } : {})
      }, body: raw || (payload === undefined ? undefined : JSON.stringify(payload))
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, headers: response.headers,
      payload: response.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(bytes.toString('utf8')) : null,
      cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function login(username) {
    const result = await request('/api/login', { method: 'POST', data: { username, password: PASSWORD } });
    assert.equal(result.status, 200);
    return { cookie: result.cookie, csrf: result.payload.csrfToken };
  }
  async function create(auth) {
    const id = `legacy:${randomUUID()}`, mutationId = randomUUID();
    const payload = { id, mutationId, baseRevision: 0, data };
    const response = await request('/api/contacts', { method: 'POST', auth, data: payload });
    assert.equal(response.status, 200);
    return { id, payload, path: `/api/contacts/${encodeURIComponent(id)}` };
  }
  async function close() {
    await new Promise(done => server.close(done)); db.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir(), 'bvl-contact-photos-')));
    rmSync(directory, { recursive: true, force: true });
  }
  return { directory, db, request, login, create, close };
}

test('Visitenkartenfotos sind geschützt, komprimiert, unveränderlich und auf zwei begrenzt', async () => {
  const f = await fixture();
  try {
    const staff = await f.login('staff'), other = await f.login('other'), admin = await f.login('admin'), dealer = await f.login('dealer');
    const contact = await f.create(staff), photoId = randomUUID(), path = `${contact.path}/photos/${photoId}`;
    const source = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#f8fafc' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    assert.equal((await f.request(path)).status, 401);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await f.request(path, { method, raw: method === 'PUT' ? source : undefined, auth: dealer })).status, 403);
      assert.equal((await f.request(path, { method, raw: method === 'PUT' ? source : undefined, auth: other })).status, 404);
    }
    assert.equal((await f.request(path, { method: 'PUT', raw: source, auth: staff, csrf: 'wrong' })).status, 403);
    assert.equal((await f.request(path, { method: 'PUT', raw: source, auth: staff, origin: 'https://other.example' })).status, 403);
    assert.equal((await f.request(path, { method: 'PUT', raw: source, auth: staff, contentType: 'image/png' })).status, 415);
    assert.equal((await f.request(path, { method: 'PUT', raw: Buffer.from('not-a-jpeg'), auth: staff })).status, 415);
    assert.equal((await f.request(path, { method: 'PUT', raw: Buffer.alloc(350 * 1024 + 1), auth: staff })).status, 413);
    const saved = await f.request(path, { method: 'PUT', raw: source, auth: staff });
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.photo.id, photoId);
    assert.ok(saved.payload.photo.bytes <= 250 * 1024);
    assert.deepEqual([saved.payload.photo.width, saved.payload.photo.height], [1200, 1600]);
    const fetched = await f.request(path, { auth: admin });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'image/jpeg');
    assert.equal(fetched.headers.get('cache-control'), 'no-store');
    assert.equal(fetched.bytes.length, saved.payload.photo.bytes);
    const metadata = await sharp(fetched.bytes).metadata();
    assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
    assert.deepEqual((await f.request(path, { method: 'PUT', raw: source, auth: staff })).payload, saved.payload);
    const changed = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#be232b' } }).jpeg().toBuffer();
    assert.equal((await f.request(path, { method: 'PUT', raw: changed, auth: staff })).status, 409);
    const second = randomUUID();
    assert.equal((await f.request(`${contact.path}/photos/${second}`, { method: 'PUT', raw: changed, auth: admin })).status, 200);
    assert.equal((await f.request(`${contact.path}/photos/${randomUUID()}`, { method: 'PUT', raw: changed, auth: staff })).status, 409);
    const list = await f.request('/api/contacts?scope=mine', { auth: staff });
    assert.equal(list.payload.contacts[0].photos.length, 2);
    assert.equal(list.payload.contacts[0].photos[0].id, photoId);
    assert.equal((await f.request('/api/contacts', { method: 'POST', auth: staff, data: contact.payload })).payload.contact.photos.length, 2);
    assert.equal((await f.request(`${contact.path}/communication`, { method: 'POST', auth: staff, data: { kind: 'thanks', state: 'opened' } })).payload.contact.photos.length, 2);
    assert.equal((await f.request('/api/admin/contacts', { auth: admin })).payload.contacts[0].photos.length, 2);
    assert.equal((await f.request(`/contact-photos/${photoId}.jpg`, { auth: staff })).status, 404);
    assert.equal((await f.request(`${contact.path}/photos/not-a-uuid`, { method: 'PUT', raw: source, auth: staff })).status, 400);
    assert.equal((await f.request(`${contact.path}/photos/11111111-1111-4111-8111-11111111111A`, { method: 'PUT', raw: source, auth: staff })).status, 400);
    const otherContact = await f.create(staff);
    assert.equal((await f.request(`${otherContact.path}/photos/${photoId}`, { method: 'PUT', raw: source, auth: staff })).status, 404);
    assert.equal((await f.request(`${otherContact.path}/photos/${photoId}`, { auth: staff })).status, 404);
    assert.equal((await f.request(`${otherContact.path}/photos/${photoId}`, { method: 'DELETE', auth: admin })).status, 404);
    assert.equal((await f.request(path, { method: 'DELETE', auth: admin })).status, 200);
    assert.equal((await f.request(path, { method: 'DELETE', auth: staff })).status, 200);
    assert.equal((await f.request(path, { auth: staff })).status, 404);
    assert.equal((await f.request(path, { method: 'PUT', raw: source, auth: staff })).status, 410);
    assert.equal((await f.request(`${otherContact.path}/photos/${photoId}`, { method: 'PUT', raw: source, auth: staff })).status, 404);
    await assert.rejects(readFile(join(f.directory, 'contact-photos', `${photoId}.jpg`)), { code: 'ENOENT' });
    const neverUploaded = `${contact.path}/photos/${randomUUID()}`;
    assert.equal((await f.request(neverUploaded, { method: 'DELETE', auth: staff })).status, 200);
    assert.equal((await f.request(neverUploaded, { method: 'PUT', raw: source, auth: staff })).status, 410);
    assert.equal((await f.request(contact.path, { method: 'DELETE', auth: staff })).status, 200);
    assert.equal((await f.request(`${contact.path}/photos/${second}`, { method: 'PUT', raw: changed, auth: staff })).status, 410);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM contact_photos WHERE contact_id=?').get(contact.id).n, 0);
    await assert.rejects(readFile(join(f.directory, 'contact-photos', `${second}.jpg`)), { code: 'ENOENT' });
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4);
    assert.equal((await f.request('/api/contacts?scope=mine', { auth: staff })).payload.contacts[0].id, otherContact.id);
  } finally { await f.close(); }
});

test('Fotos und SQLite werden zusammen gesichert; fehlende Bilder verhindern eine Erfolgsmeldung', async () => {
  const f = await fixture();
  try {
    const staff = await f.login('staff'), contact = await f.create(staff), photoId = randomUUID();
    const image = await sharp({ create: { width: 500, height: 300, channels: 3, background: 'white' } }).jpeg().toBuffer();
    assert.equal((await f.request(`${contact.path}/photos/${photoId}`, { method: 'PUT', raw: image, auth: staff })).status, 200);
    const backupDirectory = join(f.directory, 'backups');
    const result = await createSalesBackup({ databaseFile: join(f.directory, 'sales.sqlite'), dataDirectory: f.directory, backupDirectory });
    assert.equal(result.photoCount, 1);
    const snapshot = new DatabaseSync(result.database, { readOnly: true });
    try {
      assert.equal(snapshot.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 1);
      assert.equal(snapshot.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4);
      assert.equal(snapshot.prepare('SELECT id FROM contact_photos').get().id, photoId);
    } finally { snapshot.close(); }
    assert.deepEqual(await readFile(join(result.directory, 'contact-photos', `${photoId}.jpg`)), await readFile(join(f.directory, 'contact-photos', `${photoId}.jpg`)));
    assert.equal(JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8')).photoCount, 1);
    await unlink(join(f.directory, 'contact-photos', `${photoId}.jpg`));
    await assert.rejects(createSalesBackup({ databaseFile: join(f.directory, 'sales.sqlite'), dataDirectory: f.directory, backupDirectory }), /Backup incomplete/);
    assert.equal((await readdir(backupDirectory)).length, 1);
  } finally { await f.close(); }
});
