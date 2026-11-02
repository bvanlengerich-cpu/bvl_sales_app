import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_LIMITS, fitPhotoDimensions, validatePhotoFile, parseBusinessCardText, photoEditorHtml } from '../public/contact-photos.js';

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

test('German business card suggestions separate fields and retain street names with German suffixes', () => {
  const text = 'Max Mustermann\nMuster Maschinen GmbH\nVertriebsleiter\nMusterstraße 12a\nD-48488 Emsbüren\nTel.: +49 5903 123456\nMobil: +49 171 1234567\nFax: +49 5903 999999\nmax+messe@example.com\nwww.example.com';
  assert.deepEqual(parseBusinessCardText(text), {
    name: 'Max Mustermann', company: 'Muster Maschinen GmbH', email: 'max+messe@example.com',
    phone: '+49 5903 123456', mobile: '+49 171 1234567', street: 'Musterstraße 12a', postalCode: '48488', city: 'Emsbüren'
  });
  assert.equal(parseBusinessCardText(text.replace('Musterstraße 12a', 'Musterstraße12a')).street, 'Musterstraße12a');
  assert.equal(parseBusinessCardText(text.replace('Musterstraße 12a', 'Hauptstr. 12')).street, 'Hauptstr. 12');
});

test('OCR suggestions handle labelled international fields and do not invent absent values', () => {
  const suggestions = parseBusinessCardText('Company: Example Ltd\nName: Jane Smith\n12 Main Street\n12345 Sample City\nPhone: +1 555 1234567\njane@example.org');
  assert.equal(suggestions.company, 'Example Ltd');
  assert.equal(suggestions.name, 'Jane Smith');
  assert.equal(suggestions.street, '12 Main Street');
  assert.equal(suggestions.email, 'jane@example.org');
  assert.equal(suggestions.mobile, undefined);
  assert.deepEqual(parseBusinessCardText(''), {});
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
