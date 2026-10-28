import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'test-market-password';

const marketRows = () => Array.from({ length: 398 }, (_, index) => ({
  state: 'Testland', name: `Kreis ${index + 1}`, farms: index, cows: index * 10,
  share50: 0.7, alt: 0.2, years: 10, used: 0.2,
  sourcePotential: index / 10, excelRow: index + 3
}));

test('market import is admin-only, atomic, persistent, and never public', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bvl-market-import-'));
  const bundledRows = JSON.parse(await readFile(new URL('../server/market-data.json', import.meta.url), 'utf8'));
  const db = openDatabase(':memory:');
  const date = new Date().toISOString();
  for (const role of ['admin', 'staff', 'dealer']) {
    db.prepare(`INSERT INTO users (id,username,display_name,password_hash,role,active,created_at,updated_at)
      VALUES (?,?,?,?,?,1,?,?)`).run(randomUUID(), role, role, hashPassword(PASSWORD), role, date, date);
  }

  let server;
  let base;
  const start = async () => {
    ({ server } = createApp({ db, config: { PUBLIC_ORIGIN: ORIGIN, DATA_DIR: directory } }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    server = null;
  };
  const request = async (path, { method = 'GET', auth, data, origin = ORIGIN, csrf = auth?.csrf } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { Cookie: auth.cookie } : {}),
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, headers: response.headers, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const login = async role => {
    const result = await request('/api/login', { method: 'POST', data: { username: role, password: PASSWORD } });
    assert.equal(result.status, 200);
    return { cookie: result.cookie, csrf: result.payload.csrfToken };
  };

  try {
    await start();
    const admin = await login('admin');
    const staff = await login('staff');
    const dealer = await login('dealer');
    const rows = marketRows();

    assert.equal((await request('/api/admin/market-data')).status, 401);
    assert.equal((await request('/api/admin/market-data', { auth: staff })).status, 403);
    assert.equal((await request('/api/admin/market-data', { auth: dealer })).status, 403);
    assert.deepEqual((await request('/api/admin/market-data', { auth: admin })).payload,
      { imported: false, available: true, source: 'bundled', rowCount: 398, updatedAt: null });

    for (const path of ['/api/market/de', '/api/market/geo']) {
      const guest = await request(path);
      assert.equal(guest.status, 401);
      assert.equal(guest.headers.get('cache-control'), 'no-store');
      const denied = await request(path, { auth: dealer });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('cache-control'), 'no-store');
    }
    for (const auth of [admin, staff]) {
      const bundled = await request('/api/market/de', { auth });
      assert.equal(bundled.status, 200);
      assert.equal(bundled.headers.get('cache-control'), 'no-store');
      assert.deepEqual(bundled.payload, bundledRows);
      const geo = await request('/api/market/geo', { auth });
      assert.equal(geo.status, 200);
      assert.equal(geo.payload.type, 'FeatureCollection');
    }

    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: staff, data: { rows } })).status, 403);
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: dealer, data: { rows } })).status, 403);
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, csrf: 'wrong', data: { rows } })).status, 403);
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, origin: 'https://other.example', data: { rows } })).status, 403);
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows: rows.slice(1) } })).status, 400);
    const duplicateRows = marketRows();
    duplicateRows[1].excelRow = duplicateRows[0].excelRow;
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows: duplicateRows } })).status, 400);
    const oversizedRows = marketRows();
    oversizedRows[0].name = 'x'.repeat(1_050_000);
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows: oversizedRows } })).status, 413);
    assert.deepEqual((await request('/api/admin/market-data', { auth: admin })).payload,
      { imported: false, available: true, source: 'bundled', rowCount: 398, updatedAt: null });

    const imported = await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows } });
    assert.equal(imported.status, 200);
    assert.equal(imported.payload.imported, true);
    assert.equal(imported.payload.available, true);
    assert.equal(imported.payload.source, 'imported');
    assert.equal(imported.payload.rowCount, 398);
    assert.ok(Date.parse(imported.payload.updatedAt));
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'market-data.json'), 'utf8')), rows);
    const served = await request('/api/market/de', { auth: staff });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('cache-control'), 'no-store');
    assert.deepEqual(served.payload, rows);

    const updatedRows = marketRows();
    updatedRows[0].farms = 999;
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows: updatedRows } })).status, 200);
    assert.equal((await request('/api/market/de', { auth: staff })).payload[0].farms, 999);
    const badRows = marketRows();
    badRows[0].sourcePotential = 'bad';
    assert.equal((await request('/api/admin/market-data', { method: 'POST', auth: admin, data: { rows: badRows } })).status, 400);
    assert.equal((await request('/api/market/de', { auth: staff })).payload[0].farms, 999);

    for (const path of ['/market-data.json', '/market-geo.json', '/server/market-data.json', '/server/market-geo.json']) {
      assert.equal((await request(path)).status, 404, `${path} must not be public`);
    }
    await stop();
    await start();
    const adminAgain = await login('admin');
    const staffAgain = await login('staff');
    assert.equal((await request('/api/session', { auth: staffAgain })).payload.user.role, 'staff');
    const status = await request('/api/admin/market-data', { auth: adminAgain });
    assert.equal(status.payload.rowCount, 398);
    assert.equal(status.payload.source, 'imported');
    assert.equal((await request('/api/market/de', { auth: adminAgain })).payload[0].farms, 999);

    await writeFile(join(directory, 'market-data.json'), 'not valid JSON');
    await stop();
    await start();
    const adminAfterCorruption = await login('admin');
    assert.equal((await request('/api/admin/market-data', { auth: adminAfterCorruption })).status, 500);
    assert.equal((await request('/api/market/de', { auth: adminAfterCorruption })).status, 500);

    await unlink(join(directory, 'market-data.json'));
    await stop();
    await start();
    const adminAfterRemoval = await login('admin');
    assert.deepEqual((await request('/api/admin/market-data', { auth: adminAfterRemoval })).payload,
      { imported: false, available: true, source: 'bundled', rowCount: 398, updatedAt: null });
    assert.deepEqual((await request('/api/market/de', { auth: adminAfterRemoval })).payload, bundledRows);
  } finally {
    await stop();
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
