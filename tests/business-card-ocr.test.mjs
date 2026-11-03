import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createBusinessCardRecognizer, BusinessCardOcrError, validateCardImage } from '../server/business-card-ocr.mjs';
import { createApp } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';
import { hashPassword } from '../server/security.mjs';

const tick = () => new Promise(done => setImmediate(done));
const line = (text, y) => ({ text, score: .99, box: [[0, y], [500, y], [500, y + 30], [0, y + 30]] });
const workerResult = id => ({ id, ok: true, elapsedMs: 120, lines: [line('Name: Anna Beispiel', 0), line('E-Mail: anna@example.com', 40), line('Tel: +49 5903 123456 | Fax: +49 5903 999999', 80)] });

function fakeWorkers(onRequest) {
  const processes = [], calls = [];
  const spawnProcess = (executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
    child.stdin = new Writable({ write(chunk, _encoding, done) {
      const message = JSON.parse(chunk.toString('utf8'));
      calls.push({ child, message });
      done();
      onRequest?.(child, message, processes.length);
    } });
    child.reply = response => child.stdout.write(JSON.stringify(response) + '\n');
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('exit', 0)); return true; };
    child.executable = executable; child.args = args; child.options = options;
    processes.push(child);
    return child;
  };
  return { processes, calls, spawnProcess };
}

test('local OCR validates compressed JPEGs and rejects oversized image dimensions', async () => {
  const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  await validateCardImage(jpeg);
  await assert.rejects(validateCardImage(Buffer.alloc(250 * 1024 + 1)), error => error.status === 413);
  await assert.rejects(validateCardImage(Buffer.from('not an image')), error => error.status === 415);
  const wide = await sharp({ create: { width: 1700, height: 200, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  await assert.rejects(validateCardImage(wide), error => error.status === 413);
});

test('local worker starts lazily, bounds its FIFO queue and extracts phone-only field values', async () => {
  const fake = fakeWorkers();
  const manager = createBusinessCardRecognizer({ python: 'local-python', modelsDir: 'local-models', maxQueued: 2, spawnProcess: fake.spawnProcess });
  assert.equal(fake.processes.length, 0);
  try {
    const first = manager.recognize(Buffer.from('image1'));
    const second = manager.recognize(Buffer.from('image2'));
    const third = manager.recognize(Buffer.from('image3'));
    await assert.rejects(manager.recognize(Buffer.from('image4')), error => error.status === 429);
    assert.equal(fake.processes.length, 1);
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.processes[0].options.windowsHide, true);
    assert.ok(fake.processes[0].args.includes('--stdio'));
    assert.equal(Buffer.from(fake.calls[0].message.imageBase64, 'base64').toString(), 'image1');
    fake.processes[0].reply(workerResult(fake.calls[0].message.id));
    assert.equal(fake.calls.length, 2);
    fake.processes[0].reply(workerResult(fake.calls[1].message.id));
    assert.equal(fake.calls.length, 3);
    fake.processes[0].reply(workerResult(fake.calls[2].message.id));
    const results = await Promise.all([first, second, third]);
    assert.equal(results[0].fields.email, 'anna@example.com');
    assert.match(results[0].fields.phone, /5903.*123456/);
    assert.doesNotMatch(results[0].fields.phone, /Fax|999999|Tel|example/);
    assert.equal(results[0].elapsedMs, 120);
  } finally { manager.close(); }
  assert.equal(fake.processes[0].killed, true);
});

test('worker failures and malformed output return safe errors; a later request can restart', async () => {
  const fake = fakeWorkers();
  const manager = createBusinessCardRecognizer({ spawnProcess: fake.spawnProcess });
  try {
    const missing = manager.recognize(Buffer.from('image'));
    fake.processes[0].emit('error', Object.assign(new Error('private filesystem detail'), { code: 'ENOENT' }));
    await assert.rejects(missing, error => error.status === 503 && !error.message.includes('filesystem'));
    const malformed = manager.recognize(Buffer.from('image'));
    fake.processes[1].stdout.write('not-json-with-private-detail\n');
    await assert.rejects(malformed, error => error.status === 502 && !error.message.includes('private'));
    const invalid = manager.recognize(Buffer.from('image'));
    fake.processes[2].reply({ ...workerResult(fake.calls.at(-1).message.id), lines: [{ text: 'secret', score: 50, box: [] }] });
    await assert.rejects(invalid, error => error.status === 502);
    const successful = manager.recognize(Buffer.from('image'));
    fake.processes[3].reply(workerResult(fake.calls.at(-1).message.id));
    assert.equal((await successful).fields.email, 'anna@example.com');
  } finally { manager.close(); }
});

test('timeout releases the worker, queued jobs restart, and cancellation does not mix responses', async () => {
  const fake = fakeWorkers((child, request, number) => { if (number > 1) queueMicrotask(() => child.reply(workerResult(request.id))); });
  const manager = createBusinessCardRecognizer({ spawnProcess: fake.spawnProcess, timeoutMs: 25 });
  try {
    const timed = manager.recognize(Buffer.from('first'));
    const following = manager.recognize(Buffer.from('second'));
    await Promise.all([
      assert.rejects(timed, error => error.status === 504),
      new Promise(done => setTimeout(done, 50))
    ]);
    assert.equal((await following).fields.email, 'anna@example.com');
    assert.equal(fake.processes[0].killed, true);
  } finally { manager.close(); }

  const waiting = fakeWorkers();
  const cancellable = createBusinessCardRecognizer({ spawnProcess: waiting.spawnProcess });
  const controller = new AbortController();
  try {
    const active = cancellable.recognize(Buffer.from('first'), { signal: controller.signal });
    const next = cancellable.recognize(Buffer.from('second'));
    controller.abort();
    await assert.rejects(active, error => error.status === 499);
    await tick();
    assert.equal(waiting.processes.length, 2);
    waiting.processes[0].reply(workerResult(waiting.calls[0].message.id));
    waiting.processes[1].reply(workerResult(waiting.calls[1].message.id));
    assert.equal((await next).fields.email, 'anna@example.com');
  } finally { cancellable.close(); }
});

test('card recognition API is authenticated, staff/admin only, CSRF protected and does not save contacts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bvl-card-recognition-'));
  const db = openDatabase(join(directory, 'sales.sqlite'));
  const stamp = new Date().toISOString(), password = 'card-test-secret';
  for (const [username, role] of [['admin', 'admin'], ['staff', 'staff'], ['dealer', 'dealer']]) {
    db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
      .run(randomUUID(), username, username, hashPassword(password), role, stamp, stamp);
  }
  const recognized = [], controllers = [];
  let closed = false;
  const recognizer = {
    async recognize(image, options) { recognized.push(image); controllers.push(options.signal); return { fields: { email: 'anna@example.com' }, warnings: [], text: 'card text', engine: 'test', elapsedMs: 1 }; },
    close() { closed = true; }
  };
  const origin = 'http://localhost:3000';
  const { server } = createApp({ db, config: { PUBLIC_ORIGIN: origin, DATA_DIR: directory }, cardRecognizer: recognizer });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const jpeg = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  async function request({ auth, csrf, requestOrigin = origin, raw = jpeg, contentType = 'image/jpeg' } = {}) {
    return fetch(base + '/api/contacts/recognize-card', { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': contentType, ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': csrf ?? auth.csrf } : {}) }, body: raw });
  }
  async function login(username) {
    const response = await fetch(base + '/api/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await response.json(); return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: data.csrfToken };
  }
  try {
    const staff = await login('staff'), admin = await login('admin'), dealer = await login('dealer');
    assert.equal((await request()).status, 401);
    assert.equal((await request({ auth: dealer })).status, 403);
    assert.equal((await request({ auth: staff, csrf: 'wrong' })).status, 403);
    assert.equal((await request({ auth: staff, requestOrigin: 'https://bad.example' })).status, 403);
    assert.equal((await request({ auth: staff, contentType: 'image/png' })).status, 415);
    assert.equal((await request({ auth: staff, raw: Buffer.alloc(250 * 1024 + 1) })).status, 413);
    assert.equal((await request({ auth: staff, raw: Buffer.from('not-an-image') })).status, 415);
    assert.equal(recognized.length, 0);
    for (const auth of [staff, admin]) {
      const response = await request({ auth });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual((await response.json()).fields, { email: 'anna@example.com' });
    }
    assert.equal(recognized.length, 2);
    assert.ok(controllers.every(signal => !signal.aborted));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 0);
    recognizer.recognize = async () => { throw new BusinessCardOcrError(503, 'Die Server-Texterkennung ist noch nicht verfügbar.'); };
    assert.equal((await request({ auth: staff })).status, 503);
  } finally {
    await new Promise(done => server.close(done)); db.close();
    assert.equal(closed, true);
    assert.ok(resolve(directory).startsWith(resolve(tmpdir(), 'bvl-card-recognition-')));
    rmSync(directory, { recursive: true, force: true });
  }
});
