import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { registerVisit, VISIT_INACTIVITY_MS } from '../server/visits.mjs';

test('counts one visit per authenticated session until 30 minutes of inactivity', () => {
  const db = openDatabase(':memory:');
  const userId = randomUUID();
  const created = new Date().toISOString();
  db.prepare(`INSERT INTO users(id,username,display_name,password_hash,role,active,created_at,updated_at)
    VALUES (?,?,?,?,?,1,?,?)`).run(userId, 'test', 'Test', 'unused', 'staff', created, created);
  for (const sessionHash of ['session-1', 'session-2']) {
    db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
      .run(sessionHash, userId, 'csrf', '2099-01-01T00:00:00.000Z', created);
  }
  const start = Date.parse('2026-09-24T12:00:00.000Z');
  try {
    assert.equal(VISIT_INACTIVITY_MS, 30 * 60 * 1000);
    assert.deepEqual(registerVisit(db, 'session-1', new Date(start)), { total: 1, counted: true });
    assert.deepEqual(registerVisit(db, 'session-1', new Date(start + 20 * 60 * 1000)), { total: 1, counted: false });
    assert.deepEqual(registerVisit(db, 'session-1', new Date(start + 49 * 60 * 1000)), { total: 1, counted: false });
    assert.deepEqual(registerVisit(db, 'session-1', new Date(start + 79 * 60 * 1000)), { total: 2, counted: true });
    assert.deepEqual(registerVisit(db, 'session-2', new Date(start + 79 * 60 * 1000)), { total: 3, counted: true });
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run('session-1');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visit_sessions WHERE session_hash=?').get('session-1').n, 0);
    assert.equal(db.prepare('SELECT total FROM visitor_counter WHERE id=1').get().total, 3);
  } finally {
    db.close();
  }
});
