import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'test-secret-2026';

function insertUser(db, username, role) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (id,username,display_name,password_hash,role,active,created_at,updated_at)
    VALUES (?,?,?,?,?,1,?,?)`).run(id, username, username, hashPassword(PASSWORD), role, now, now);
  return id;
}

async function startServer(db) {
  const { server } = createApp({ db, config: { PUBLIC_ORIGIN: ORIGIN } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', data, auth, origin = ORIGIN, csrf } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': csrf ?? auth.csrf } : {})
      },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const raw = bytes.toString('utf8');
    return {
      status: response.status,
      payload: response.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(raw) : raw,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      headers: response.headers,
      bytes
    };
  }
  async function login(username) {
    const response = await request('/api/login', { method: 'POST', data: { username, password: PASSWORD } });
    assert.equal(response.status, 200);
    return { cookie: response.cookie, csrf: response.payload.csrfToken };
  }
  return { request, login, stop: () => new Promise(resolve => server.close(resolve)) };
}

const data = (name = 'Musterbetrieb') => ({
  name, company: 'Betrieb GmbH', email: 'kunde@example.com', phone: '+49 123 456',
  city: 'Emsbüren', postalCode: '48488',
  fair: 'EuroTier', fairYear: '2026', customerLanguage: 'de',
  interests: [{ family: 'V-MIX', model: 'V-MIX Plus', variant: '2S', detail: 'Beratung' }],
  requests: ['Angebot'], notes: 'Bitte nächste Woche anrufen', priority: 'high', status: 'new',
  followUp: '2026-11-05'
});

test('Messekontakte-Link wird einmal ergänzt und nach Löschung nicht neu angelegt', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bvl-contact-link-'));
  const file = join(directory, 'sales.sqlite');
  try {
    let db = openDatabase(file);
    const link = db.prepare("SELECT * FROM links WHERE url='https://sales.bvlki.cloud/#/contacts'").get();
    assert.equal(link.title_de, 'Messekontakte');
    assert.equal(link.title_en, 'Trade fair contacts');
    assert.equal(link.icon, 'users');
    assert.equal(link.audience_staff, 1);
    assert.equal(link.audience_dealer, 0);
    assert.equal(link.active, 1);
    assert.equal(link.featured, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM app_migrations WHERE name='contacts_home_link_v1'").get().n, 1);
    db.prepare('DELETE FROM links WHERE id=?').run(link.id);
    db.close();
    db = openDatabase(file);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM links WHERE url='https://sales.bvlki.cloud/#/contacts'").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM app_migrations WHERE name='contacts_home_link_v1'").get().n, 1);
    db.prepare(`INSERT INTO links
      (id,parent_id,title_de,title_en,description_de,description_en,url,icon,audience_staff,audience_dealer,active,featured,position,created_at,updated_at)
      VALUES ('existing-contact-link',NULL,'Bestehend','Existing','','','https://sales.bvlki.cloud/#/contacts','users',1,0,1,0,100,'2026-01-01','2026-01-01')`).run();
    db.prepare("DELETE FROM app_migrations WHERE name='contacts_home_link_v1'").run();
    db.close();
    db = openDatabase(file);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM links WHERE url='https://sales.bvlki.cloud/#/contacts'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM app_migrations WHERE name='contacts_home_link_v1'").get().n, 1);
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Messekontakte bleiben geschützt, revisionssicher und in bestehender Sales-Datenbank erhalten', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bvl-contacts-'));
  const file = join(directory, 'sales.sqlite');
  let db = openDatabase(file);
  let server;
  try {
    const adminId = insertUser(db, 'admin', 'admin');
    const staffId = insertUser(db, 'staff', 'staff');
    insertUser(db, 'other', 'staff');
    insertUser(db, 'dealer', 'dealer');
    db.prepare('UPDATE lead_times SET towed_weeks=20 WHERE id=1').run();
    server = await startServer(db);
    const { request, login } = server;
    const admin = await login('admin');
    const staff = await login('staff');
    const other = await login('other');
    const dealer = await login('dealer');
    assert.equal((await request('/api/contacts')).status, 401);
    assert.equal((await request('/api/admin/contacts')).status, 401);
    assert.equal((await request('/api/contacts', { auth: dealer })).status, 403);
    assert.equal((await request('/api/admin/contacts', { auth: dealer })).status, 403);
    assert.equal((await request('/api/admin/contacts/export.csv', { auth: staff })).status, 403);
    assert.equal((await request('/api/admin/contacts', { auth: staff })).status, 403);
    const id = randomUUID();
    const mutationId = randomUUID();
    const create = { id, mutationId, baseRevision: 0, data: data() };
    assert.equal((await request('/api/contacts', { method: 'POST', data: create, auth: dealer })).status, 403);
    assert.equal((await request('/api/contacts', { method: 'POST', data: create, auth: staff, origin: 'https://bad.example' })).status, 403);
    assert.equal((await request('/api/contacts', { method: 'POST', data: create, auth: staff, csrf: 'wrong' })).status, 403);
    const saved = await request('/api/contacts', { method: 'POST', data: create, auth: staff });
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.contact.revision, 1);
    assert.equal(saved.payload.contact.ownerId, staffId);
    assert.equal(saved.payload.contact.ownerName, 'staff');
    assert.equal(saved.payload.contact.data.name, 'Musterbetrieb');
    assert.equal(saved.headers.get('cache-control'), 'no-store');
    const retry = await request('/api/contacts', { method: 'POST', data: create, auth: staff });
    assert.deepEqual(retry.payload, saved.payload);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contact_mutations').get().n, 1);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff, data: { ...create, data: data('Andere Version') } })).status, 409);
    assert.equal((await request('/api/contacts', { auth: other })).payload.contacts.length, 0);
    assert.equal((await request('/api/contacts', { auth: staff })).payload.contacts.length, 1);
    assert.equal((await request('/api/contacts', { auth: admin })).payload.contacts.length, 1);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: other, data: { ...create, mutationId: randomUUID(), baseRevision: 1 } })).status, 404);

    const update = { id, mutationId: randomUUID(), baseRevision: 1, data: data('Aktualisiert') };
    const updated = await request('/api/contacts', { method: 'POST', data: update, auth: staff });
    assert.equal(updated.status, 200);
    assert.equal(updated.payload.contact.revision, 2);
    const conflict = await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id, mutationId: randomUUID(), baseRevision: 1, data: data('Veraltet') } });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.payload.contact.revision, 2);
    assert.equal(conflict.payload.contact.data.name, 'Aktualisiert');
    assert.equal((await request('/api/contacts', { auth: staff })).payload.contacts[0].data.name, 'Aktualisiert');
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id: randomUUID(), mutationId: randomUUID(), baseRevision: 0, data: { ...data(), email: 'evil@example.com\r\nBcc:x' } } })).status, 400);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id: randomUUID(), mutationId: randomUUID(), baseRevision: 0, data: { ...data(), notes: 'x'.repeat(10001) } } })).status, 400);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id: randomUUID(), mutationId: randomUUID(), baseRevision: 0, data: { ...data(), unknown: 'value' } } })).status, 400);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id: randomUUID(), mutationId: randomUUID(), baseRevision: 0, data: { ...data(), interests: Array(31).fill({}) } } })).status, 400);
    assert.equal((await request('/api/contacts', { method: 'POST', auth: staff,
      data: { id: randomUUID(), mutationId: randomUUID(), baseRevision: 0, data: { ...data(), notes: 'x'.repeat(100001) } } })).status, 413);

    const adminView = await request('/api/admin/contacts?q=aktualisiert&fair=EuroTier&year=2026&status=new&priority=high&ownerId=' + staffId, { auth: admin });
    assert.equal(adminView.status, 200);
    assert.equal(adminView.payload.contacts.length, 1);
    assert.deepEqual(adminView.payload.fairs, [{ fair: 'EuroTier', year: '2026' }]);
    assert.deepEqual(adminView.payload.owners, [{ id: staffId, name: 'staff' }]);
    assert.equal((await request('/api/admin/contacts?q=Emsb%C3%BCren', { auth: admin })).payload.contacts.length, 1);
    assert.equal((await request('/api/admin/contacts?q=48488', { auth: admin })).payload.contacts.length, 1);
    assert.equal((await request('/api/admin/contacts?status=done', { auth: admin })).payload.contacts.length, 0);
    assert.equal((await request('/api/admin/contacts?status=invalid', { auth: admin })).status, 400);
    const secondId = randomUUID();
    const formula = await request('/api/contacts', { method: 'POST', auth: admin, data: {
      id: secondId, mutationId: randomUUID(), baseRevision: 0, data: { ...data('=SUM(1,1)'), email: 'other@example.com', fair: 'Agritechnica', notes: 'A; "B"' }
    } });
    assert.equal(formula.status, 200);
    assert.equal(formula.payload.contact.ownerId, adminId);
    const adminOwn = await request('/api/contacts?scope=mine', { auth: admin });
    assert.deepEqual(adminOwn.payload.contacts.map(contact => contact.id), [secondId]);
    assert.equal((await request('/api/contacts', { auth: admin })).payload.contacts.length, 2);
    assert.deepEqual((await request('/api/contacts?scope=mine', { auth: staff })).payload.contacts.map(contact => contact.id), [id]);
    assert.equal((await request('/api/contacts?scope=invalid', { auth: admin })).status, 400);
    assert.equal((await request('/api/contacts?other=1', { auth: admin })).status, 400);
    const csv = await request(`/api/admin/contacts/export.csv?ids=${secondId}`, { auth: admin });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /^text\/csv/);
    assert.equal(csv.headers.get('cache-control'), 'no-store');
    assert.deepEqual([...csv.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.match(csv.payload, /"'=SUM\(1,1\)"/);
    assert.match(csv.payload, /"A; ""B"""/);
    assert.ok(csv.payload.includes(secondId));
    assert.ok(!csv.payload.includes(id));
    const filteredCsv = await request(`/api/admin/contacts/export.csv?q=Aktualisiert&fair=EuroTier&year=2026&status=new&priority=high&ownerId=${staffId}&ids=${id}`, { auth: admin });
    assert.equal(filteredCsv.status, 200);
    assert.ok(filteredCsv.payload.includes(id));
    assert.ok(!filteredCsv.payload.includes(secondId));
    assert.equal((await request('/api/admin/contacts?q=%27%3BDELETE%20FROM%20contacts', { auth: admin })).payload.contacts.length, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 2);
    assert.equal(db.prepare('SELECT towed_weeks FROM lead_times WHERE id=1').get().towed_weeks, 20);

    await server.stop();
    db.close();
    db = openDatabase(file);
    server = await startServer(db);
    const afterRestart = await server.login('staff');
    assert.equal((await server.request('/api/contacts', { auth: afterRestart })).payload.contacts[0].revision, 2);
    assert.equal((await server.request('/api/contacts', { method: 'POST', auth: afterRestart, data: update })).payload.contact.revision, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contact_mutations').get().n, 3);
    assert.equal(db.prepare('SELECT towed_weeks FROM lead_times WHERE id=1').get().towed_weeks, 20);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4);
  } finally {
    if (server) await server.stop().catch(() => {});
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
