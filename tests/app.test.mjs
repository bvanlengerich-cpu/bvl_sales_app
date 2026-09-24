import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword, validPassword } from '../server/security.mjs';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'A-strong-test-password-2026';

test('passwords require 6 to 256 characters', () => {
  assert.equal(validPassword('12345'), false);
  assert.equal(validPassword('123456'), true);
  assert.equal(validPassword('x'.repeat(256)), true);
  assert.equal(validPassword('x'.repeat(257)), false);
});

test('login, access rules, admin editing and messages', async () => {
  const db = openDatabase(':memory:');
  const insertUser = (username, role, canEditLeadTimes = 0) => {
    const id = randomUUID();
    const date = new Date().toISOString();
    db.prepare(`INSERT INTO users (id,username,display_name,password_hash,role,can_edit_lead_times,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,1,?,?)`).run(id, username, username, hashPassword(PASSWORD), role, canEditLeadTimes, date, date);
    return id;
  };
  const adminId = insertUser('admin', 'admin');
  const staffId = insertUser('staff', 'staff', 1);
  insertUser('dealer', 'dealer');
  const { server } = createApp({ db, config: { PUBLIC_ORIGIN: ORIGIN } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = async (path, { method = 'GET', data, auth, origin = ORIGIN } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken } : {})
      },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const payload = await response.json();
    return { status: response.status, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const login = async username => {
    const result = await request('/api/login', { method: 'POST', data: { username, password: PASSWORD } });
    assert.equal(result.status, 200);
    return { cookie: result.cookie, csrfToken: result.payload.csrfToken };
  };

  try {
    assert.equal((await request('/api/portal')).status, 401);
    assert.equal(db.prepare('SELECT total FROM visitor_counter WHERE id=1').get().total, 0);
    assert.equal((await request('/api/login', { method: 'POST', data: { username: 'admin', password: PASSWORD }, origin: 'https://evil.example' })).status, 403);
    const admin = await login('admin');
    assert.equal((await request('/api/session', { auth: admin })).payload.user.id, adminId);
    assert.equal((await request('/api/admin/users', { auth: admin })).status, 200);
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 3, selfWeeks: 7 }, auth: admin })).status, 200);
    const firstPortal = (await request('/api/portal', { auth: admin })).payload;
    const lead = firstPortal.leadTimes;
    assert.equal(lead.towedWeeks, 3);
    assert.equal(lead.selfWeeks, 7);
    assert.equal(firstPortal.visitorCount, 1);
    assert.equal((await request('/api/portal', { auth: admin })).payload.visitorCount, 1);
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 0, selfWeeks: 7 }, auth: admin })).status, 400);
    assert.equal((await request('/api/admin/users', { method: 'POST', data: { username: 'bad', displayName: 'Bad', role: 'staff', password: 'short' }, auth: admin })).status, 400);
    const sixUser = await request('/api/admin/users', { method: 'POST', data: {
      username: 'six', displayName: 'Six', role: 'staff', password: '123456'
    }, auth: admin });
    assert.equal(sixUser.status, 201);
    const sixLogin = await request('/api/login', { method: 'POST', data: { username: 'six', password: '123456' } });
    assert.equal(sixLogin.status, 200);
    const sixAuth = { cookie: sixLogin.cookie, csrfToken: sixLogin.payload.csrfToken };
    assert.equal((await request('/api/profile/password', { method: 'POST', data: {
      currentPassword: '123456', newPassword: 'short'
    }, auth: sixAuth })).status, 400);
    assert.equal((await request('/api/profile/password', { method: 'POST', data: {
      currentPassword: '123456', newPassword: 'abcdef'
    }, auth: sixAuth })).status, 200);
    assert.equal((await request(`/api/admin/users/${sixUser.payload.user.id}`, { method: 'PUT', data: {
      displayName: 'Six', role: 'staff', active: true, password: 'short'
    }, auth: admin })).status, 400);
    assert.equal((await request(`/api/admin/users/${sixUser.payload.user.id}`, { method: 'PUT', data: {
      displayName: 'Six', role: 'staff', active: true, password: '654321'
    }, auth: admin })).status, 200);
    assert.equal((await request('/api/login', { method: 'POST', data: {
      username: 'six', password: '654321'
    } })).status, 200);

    const created = await request('/api/admin/links', { method: 'POST', auth: admin, data: {
      titleDe: 'Nur intern', titleEn: 'Staff only', icon: 'file-text', url: 'https://example.org',
      audienceStaff: true, audienceDealer: false, active: true, featured: false, position: 90
    } });
    assert.equal(created.status, 201);
    const internalLinkId = created.payload.link.id;
    assert.equal((await request('/api/admin/links', { method: 'POST', auth: admin, data: {
      titleDe: 'Unsicher', titleEn: 'Unsafe', icon: 'file-text', url: 'javascript:alert(1)', position: 91
    } })).status, 400);

    const staff = await login('staff');
    assert.equal((await request('/api/admin/users', { auth: staff })).status, 403);
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 4, selfWeeks: 8 }, auth: staff })).status, 200);
    const staffPortal = (await request('/api/portal', { auth: staff })).payload;
    assert.equal(staffPortal.links.some(link => link.id === internalLinkId), true);
    assert.equal(staffPortal.visitorCount, 2);
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 4, selfWeeks: 8 }, auth: staff, origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 4, selfWeeks: 8 }, auth: { ...staff, csrfToken: 'invalid' } })).status, 403);
    assert.equal((await request('/api/session', { auth: staff })).payload.user.id, staffId);

    const dealer = await login('dealer');
    assert.equal((await request('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: 4, selfWeeks: 8 }, auth: dealer })).status, 403);
    const dealerPortal = (await request('/api/portal', { auth: dealer })).payload;
    assert.equal(dealerPortal.links.some(link => link.id === internalLinkId), false);
    assert.equal(dealerPortal.visitorCount, 3);
    const message = await request('/api/admin/messages', { method: 'POST', auth: admin, data: {
      titleDe: 'Intern', titleEn: 'Internal', bodyDe: 'Test', bodyEn: 'Test', audience: 'staff', publish: true
    } });
    assert.equal(message.status, 201);
    assert.equal((await request('/api/messages', { auth: staff })).payload.messages.length, 1);
    assert.equal((await request('/api/messages', { auth: dealer })).payload.messages.length, 0);
    assert.equal((await request(`/api/messages/${message.payload.message.id}/read`, { method: 'POST', data: {}, auth: dealer })).status, 404);
    assert.equal((await request('/api/logout', { method: 'POST', data: {}, auth: dealer })).status, 200);
    assert.equal((await request('/api/session', { auth: dealer })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
