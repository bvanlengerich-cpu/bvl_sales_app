import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactMailto, isInternalContactsLink } from '../public/contacts.js';

test('the contact module only captures links to its own PWA route', () => {
  assert.equal(isInternalContactsLink('https://sales.bvlki.cloud/#/contacts', 'http://localhost:3000/#/home'), true);
  assert.equal(isInternalContactsLink('http://localhost:3000/#/contacts', 'http://localhost:3000/#/home'), true);
  assert.equal(isInternalContactsLink('https://other.example/#/contacts'), false);
  assert.equal(isInternalContactsLink('https://sales.bvlki.cloud/other/#/contacts'), false);
  assert.equal(isInternalContactsLink('https://bvl-group.canto.de/b/VL0QR'), false);
});

test('thank-you drafts encode recipients and headers, omit private conversation notes, and use the customer language', () => {
  const record = { ownerName: 'Seller', data: { name: 'Alex & Partner', email: 'alex+fair@example.com', fair: 'EuroTier & more', customerLanguage: 'de', interests: [{ model: 'V-MIX', variant: '2S', detail: 'PRIVATE requirement and price expectations' }], notes: 'INTERNAL: confidential price negotiation' } };
  const href = buildContactMailto(record, { displayName: 'Jane Seller' });
  const [recipient, query] = href.slice('mailto:'.length).split('?');
  const params = new URLSearchParams(query);
  assert.equal(decodeURIComponent(recipient), record.data.email);
  assert.match(params.get('subject'), /Vielen Dank/);
  assert.match(params.get('body'), /Alex & Partner/);
  assert.match(params.get('body'), /V-MIX \/ 2S/);
  assert.match(params.get('body'), /Jane Seller/);
  assert.doesNotMatch(params.get('body'), /INTERNAL|confidential|PRIVATE|price expectations/);
  record.data.customerLanguage = 'en';
  assert.match(new URLSearchParams(buildContactMailto(record).split('?')[1]).get('body'), /Thank you for visiting/);
  record.data.email = 'alex@example.com\r\nBcc:other@example.com';
  assert.equal(buildContactMailto(record), null);
  record.data.email = 'alex@example.com?bcc=other@example.com';
  assert.equal(buildContactMailto(record), null);
  record.data.email = '';
  assert.equal(buildContactMailto(record), null);
});

test('thank-you drafts limit product summaries to five interests and 300 characters', () => {
  const contact = { data: { email: 'alex@example.com', fair: 'Fair', customerLanguage: 'en', interests: Array.from({ length: 8 }, (_, index) => ({ model: `Machine-${index + 1}`, detail: 'Internal requirements' })) } };
  let body = new URLSearchParams(buildContactMailto(contact).split('?')[1]).get('body');
  assert.match(body, /Machine-5/);
  assert.doesNotMatch(body, /Machine-6|Machine-7|Machine-8|Internal requirements/);
  contact.data.interests = Array.from({ length: 5 }, (_, index) => ({ model: `Model${index}-${'x'.repeat(100)}`, variant: 'y'.repeat(100) }));
  body = new URLSearchParams(buildContactMailto(contact).split('?')[1]).get('body');
  const summary = body.match(/your interest in ([\s\S]*?)\./)[1];
  assert.equal(summary.length, 300);
  assert.match(summary, /…$/);
});
