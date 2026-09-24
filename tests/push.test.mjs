import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';

test('weekly milk-price push reaches active subscribed users even when the monthly value is unchanged', async () => {
  const db = openDatabase(':memory:');
  const sent = [];
  const pushClient = {
    setVapidDetails() {},
    async sendNotification(subscription, payload) { sent.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) }); }
  };
  const year = new Date().getUTCFullYear() - 1;
  const fetcher = async () => ({ ok: true, json: async () => [
    { memberStateCode: 'DE', product: 'Raw Milk', unit: '100KG', price: '€40.14', year, month: 8, endDate: `31/08/${year}` }
  ] });
  const config = {
    PUBLIC_ORIGIN: 'https://sales.example.test',
    VAPID_PUBLIC_KEY: 'test-public', VAPID_PRIVATE_KEY: 'test-private', VAPID_SUBJECT: 'mailto:test@example.test'
  };
  const created = new Date().toISOString();
  try {
    for (const [id, language, active] of [['de', 'de', 1], ['en', 'en', 1], ['inactive', 'de', 0]]) {
      db.prepare(`INSERT INTO users(id,username,display_name,password_hash,role,language,active,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(id, id, id, hashPassword('password'), id === 'de' ? 'admin' : 'staff', language, active, created, created);
      db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
        .run(`session-${id}`, id, `csrf-${id}`, new Date(Date.now() + 86400000).toISOString(), created);
      db.prepare('INSERT INTO push_subscriptions(endpoint,user_id,session_hash,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)')
        .run(`https://push.example.test/${id}`, id, `session-${id}`, 'test-key', 'test-auth', created);
    }
    const first = createApp({ db, config, fetcher, pushClient });
    const firstRefresh = await first.refreshMilkAndNotify();
    assert.equal(firstRefresh.ok, true);
    assert.equal(firstRefresh.push.sent, 2);
    assert.equal(sent.length, 2);
    assert.equal(sent.find(item => item.endpoint.endsWith('/de')).title, 'Milchpreis Deutschland');
    assert.match(sent.find(item => item.endpoint.endsWith('/en')).body, /40\.14 ct\/kg/);
    assert.ok(sent.every(item => item.url === '/#/home'));
    assert.equal((await first.refreshMilkAndNotify()).skipped, true);
    assert.equal(sent.length, 2);

    db.prepare('UPDATE milk_cache SET fetched_at=? WHERE id=1')
      .run(new Date(Date.now() - 8 * 86400000).toISOString());
    const nextWeek = createApp({ db, config, fetcher, pushClient });
    const secondRefresh = await nextWeek.refreshMilkAndNotify();
    assert.equal(secondRefresh.ok, true);
    assert.equal(secondRefresh.push.sent, 2);
    assert.equal(sent.length, 4);

    db.prepare('UPDATE milk_cache SET fetched_at=? WHERE id=1')
      .run(new Date(Date.now() - 8 * 86400000).toISOString());
    const offline = createApp({ db, config, fetcher: async () => { throw new Error('offline'); }, pushClient });
    assert.equal((await offline.refreshMilkAndNotify()).ok, false);
    assert.equal(sent.length, 4);

    const { server } = createApp({ db, config, fetcher, pushClient });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const login = await fetch(`${base}/api/login`, {
        method: 'POST', headers: { Origin: config.PUBLIC_ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'de', password: 'password' })
      });
      assert.equal(login.status, 200);
      const { csrfToken } = await login.json();
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const message = await fetch(`${base}/api/admin/messages`, {
        method: 'POST', headers: {
          Origin: config.PUBLIC_ORIGIN, 'Content-Type': 'application/json',
          Cookie: cookie, 'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ titleDe: 'Test', titleEn: 'Test', bodyDe: 'Hallo', bodyEn: 'Hello', audience: 'all', publish: true })
      });
      assert.equal(message.status, 201);
      assert.equal((await message.json()).push.sent, 2);
      assert.equal(sent.length, 6);
      assert.ok(sent.slice(4).every(item => item.url.startsWith('/#/messages/')));
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    db.close();
  }
});
