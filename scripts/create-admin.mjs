import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Writable } from 'node:stream';
import { openDatabase } from '../server/db.mjs';
import { hashPassword, validPassword } from '../server/security.mjs';

const username = process.argv[2]?.trim();
const displayName = process.argv[3]?.trim() || username;
if (!username || username.length < 3 || username.length > 80) {
  console.error('Usage: pnpm admin:create <username> [display name]');
  process.exit(1);
}
let password = process.env.ADMIN_INITIAL_PASSWORD;
if (!password) {
  if (!input.isTTY) {
    console.error('Set ADMIN_INITIAL_PASSWORD or run in an interactive terminal.');
    process.exit(1);
  }
  output.write('Initial password (min. 12 characters, hidden): ');
  const silentOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const terminal = createInterface({ input, output: silentOutput, terminal: true });
  password = await terminal.question('');
  terminal.close();
  output.write('\n');
}
if (!validPassword(password)) {
  console.error('Password must have 12-256 characters.');
  process.exit(1);
}
const db = openDatabase();
const now = new Date().toISOString();
try {
  db.prepare(`INSERT INTO users (id,username,display_name,password_hash,role,can_edit_lead_times,active,created_at,updated_at)
    VALUES (?,?,?,?,'admin',1,1,?,?)`).run(randomUUID(), username, displayName, hashPassword(password), now, now);
  console.log(`Admin '${username}' created.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
