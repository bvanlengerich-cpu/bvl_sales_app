import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_LIMITS, fitPhotoDimensions, validatePhotoFile, normalizeBusinessCardRecognition, recognizeBusinessCard, businessCardReviewHtml, photoEditorHtml } from '../public/contact-photos.js';

test('large camera originals are accepted while final photo dimensions are bounded without upscaling', () => {
  const original = new Blob([new Uint8Array(4 * 1024 * 1024)], { type: 'image/jpeg' });
  assert.equal(validatePhotoFile(original), true);
  assert.ok(original.size > PHOTO_LIMITS.bytes);
  assert.deepEqual(fitPhotoDimensions(8064, 6048), { width: 1600, height: 1200 });
  assert.deepEqual(fitPhotoDimensions(6048, 8064), { width: 1200, height: 1600 });
  assert.deepEqual(fitPhotoDimensions(800, 500), { width: 800, height: 500 });
  assert.ok(8064 * 6048 <= PHOTO_LIMITS.pixels, 'normal 48 MP iPhone photos remain supported');
  assert.throws(() => fitPhotoDimensions(0, 100), TypeError);
  assert.equal(validatePhotoFile(new Blob(['not a photo'], { type: 'text/html' })), false);
  assert.equal(validatePhotoFile(new Blob([new Uint8Array(PHOTO_LIMITS.inputBytes + 1)], { type: 'image/jpeg' })), false);
});

test('server suggestions accept only contact fields and reject whole phone lines and malformed email addresses', () => {
  const result = normalizeBusinessCardRecognition({ fields: {
    name: ' Max\nMustermann ', phone: '+49 5903 123456 Fax +49 5903 999999', mobile: '+49 171 1234567',
    email: 'max@example.com\r\nBcc:other@example.com', notes: 'Never overwrite existing conversation notes', role: 'admin'
  }, warnings: ['Mehrere Telefonnummern erkannt; bitte auswählen.'], text: 'Raw text' });
  assert.deepEqual(result.fields, { name: 'Max Mustermann', mobile: '+49 171 1234567' });
  assert.equal(result.warnings.length, 1);
  assert.throws(() => normalizeBusinessCardRecognition({ fields: [] }), /Ungültige Antwort/);
  assert.throws(() => normalizeBusinessCardRecognition(null), /Ungültige Antwort/);
});

test('recognition sends the prepared JPEG to the authenticated request adapter and uses structured server fields', async () => {
  const blob = new Blob(['prepared JPEG'], { type: 'image/jpeg' }), controller = new AbortController();
  let calls = 0;
  const result = await recognizeBusinessCard(blob, { signal: controller.signal, request: async (sent, options) => {
    calls++;
    assert.equal(sent, blob);
    assert.equal(options.signal, controller.signal);
    return { fields: { name: 'Jane Smith', phone: '+1 202 555 0123', email: 'jane@example.org' }, warnings: [], text: 'Tel +1 202 555 0123 | Fax +1 202 555 0999', engine: 'RapidOCR' };
  } });
  assert.equal(calls, 1);
  assert.equal(result.fields.phone, '+1 202 555 0123');
  assert.equal(result.fields.mobile, undefined);
  assert.equal(result.engine, 'RapidOCR');
  assert.doesNotMatch(result.fields.phone, /Fax/);
});

test('recognition preserves server failures and aborts without a fallback to local text guesses', async () => {
  const blob = new Blob(['prepared JPEG'], { type: 'image/jpeg' }), failure = Object.assign(new Error('Server offline'), { status: 503 });
  await assert.rejects(recognizeBusinessCard(blob, { request: async () => { throw failure; } }), error => error === failure);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(recognizeBusinessCard(blob, { signal: controller.signal, request: () => { throw new Error('Must not run'); } }), { name: 'AbortError' });
  const midFlight = new AbortController();
  await assert.rejects(recognizeBusinessCard(blob, { signal: midFlight.signal, request: async () => { midFlight.abort(); return { fields: { name: 'Late result' } }; } }), { name: 'AbortError' });
  await assert.rejects(recognizeBusinessCard(new Blob([new Uint8Array(PHOTO_LIMITS.bytes + 1)], { type: 'image/jpeg' }), { request: () => { throw new Error('Must not run'); } }), /komprimiertes JPEG/);
});

test('review leaves existing fields unselected and escapes server text and warnings', () => {
  const html = businessCardReviewHtml({ fields: { name: 'Jane Smith', email: 'jane@example.org' }, warnings: ['<b>check</b>'], text: '<script>alert(1)</script>' }, { name: 'Existing name' }, 'de');
  assert.match(html, /data-ocr-field="name">/);
  assert.match(html, /data-ocr-field="email" checked/);
  assert.match(html, /&lt;b&gt;check&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>|<b>check/);
  assert.match(html, /Ausgewählte Angaben übernehmen/);
});

test('photo capture presents native camera and gallery choices with automatic final-size guidance', () => {
  const html = photoEditorHtml('de');
  assert.match(html, /capture="environment"/);
  assert.match(html, /Visitenkarte fotografieren/);
  assert.match(html, /Foto hinzufügen/);
  assert.match(html, /Originalfotos bis 25 MB werden automatisch verkleinert/);
  assert.match(html, /maximal 250 KB pro Bild/);
  assert.equal((html.match(/type="file"/g) || []).length, 2);
});
