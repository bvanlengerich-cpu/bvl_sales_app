import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactMailto, buildContactForwardMailto, isInternalContactsLink } from '../public/contacts.js';

test('the contact module only captures links to its own PWA route', () => {
  assert.equal(isInternalContactsLink('https://sales.bvlki.cloud/#/contacts', 'http://localhost:3000/#/home'), true);
  assert.equal(isInternalContactsLink('http://localhost:3000/#/contacts', 'http://localhost:3000/#/home'), true);
  assert.equal(isInternalContactsLink('https://other.example/#/contacts'), false);
  assert.equal(isInternalContactsLink('https://sales.bvlki.cloud/other/#/contacts'), false);
  assert.equal(isInternalContactsLink('https://bvl-group.canto.de/b/VL0QR'), false);
});

test('thank-you drafts encode recipients and headers, omit private conversation notes, and use the customer language', () => {
  const record = { ownerName: 'Seller', data: { name: 'Alex & Partner', email: 'alex+fair@example.com', fair: 'EuroTier & more', customerLanguage: 'de', interests: [{ model: 'V-MIX Plus', variant: '1S', detail: 'PRIVATE requirement and price expectations' }], notes: 'INTERNAL: confidential price negotiation' } };
  const href = buildContactMailto(record, { displayName: 'Jane Seller' });
  const [recipient, query] = href.slice('mailto:'.length).split('?');
  const params = new URLSearchParams(query);
  assert.equal(decodeURIComponent(recipient), record.data.email);
  assert.match(params.get('subject'), /Vielen Dank/);
  assert.match(params.get('body'), /Alex & Partner/);
  assert.match(params.get('body'), /Gerne greifen wir Ihr Interesse an folgendem\/n Produkt\/en auf: V-MIX Plus \/ 1S\./);
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
  const summary = body.match(/the following product\(s\): ([\s\S]*?)\./)[1];
  assert.equal(summary.length, 300);
  assert.match(summary, /…$/);
});

test('contact forwarding leaves the recipient empty and includes complete captured details and requests', () => {
  const record = {
    id: 'contact-123', ownerName: 'Original Seller', createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z',
    data: {
      name: 'Alex & Partner', company: 'Farm #1', email: 'alex+fair@example.com', phone: '+49 123', mobile: '+49 456',
      street: 'Musterstraße 1', postalCode: '48488', city: 'Emsbüren', country: 'Deutschland', customerLanguage: 'de',
      fair: 'EuroTier & more', fairYear: '2026', interests: [
        { family: 'V-MIX', model: 'V-MIX Plus', variant: '1S', detail: 'Preis & Vorführung erbeten' },
        { family: 'V-LOAD', model: 'Cutter', variant: 'XL', detail: 'Zweite Anforderung' }
      ], requests: ['visit', 'offer', 'demo', 'service'], status: 'in_progress', priority: 'high', followUp: '2026-11-09',
      cows: '123', currentMachine: 'Previous brand', machineYear: '2014', volume: '20 m³', purchaseTime: 'Frühjahr 2027',
      notes: `Erste Zeile\nZweite Zeile mit ?bcc=someone@example.com & Sonderzeichen ${'x'.repeat(1500)}`
    }
  };
  const href = buildContactForwardMailto(record, { displayName: 'Admin Sender' });
  assert.ok(href.startsWith('mailto:?subject='));
  const params = new URLSearchParams(href.slice('mailto:?'.length));
  assert.deepEqual([...params.keys()], ['subject', 'body']);
  assert.equal(params.get('subject'), 'Messekontakt · Alex & Partner · EuroTier & more');
  const body = params.get('body');
  for (const value of ['contact-123', 'Original Seller', 'Admin Sender', record.createdAt, record.updatedAt, ...Object.entries(record.data).filter(([key]) => !['interests', 'requests', 'status', 'priority', 'notes'].includes(key)).map(([, value]) => String(value))]) assert.ok(body.includes(value), `Missing field: ${value}`);
  assert.ok(body.includes(record.data.notes));
  assert.match(body, /1\. V-MIX \/ V-MIX Plus \/ 1S \/ Preis & Vorführung erbeten/);
  assert.match(body, /2\. V-LOAD \/ Cutter \/ XL \/ Zweite Anforderung/);
  assert.match(body, /Vereinbarte Aktionen: Kundenbesuch, Angebot, Vorführung, Service \/ Reklamation/);
  assert.match(body, /Bearbeitungsstatus: In Bearbeitung/);
  assert.match(body, /Priorität: Hoch/);
  assert.match(body, /\r\n/);
});

test('forwarding uses the interface language and keeps untrusted header text inside the encoded subject', () => {
  const contact = { data: { name: 'Alex\r\nBcc: other@example.com', fair: 'Fair', interests: [{ family: 'V-MIX' }], requests: ['offer'], notes: 'Full notes' } };
  const params = new URLSearchParams(buildContactForwardMailto(contact, {}, 'en').split('?')[1]);
  assert.match(params.get('subject'), /^Trade fair contact · Alex Bcc:/);
  assert.doesNotMatch(params.get('subject'), /[\r\n]/);
  assert.equal(params.get('bcc'), null);
  assert.match(params.get('body'), /Agreed actions: Quotation/);
  assert.match(params.get('body'), /Conversation notes: Full notes/);
  assert.match(params.get('body'), /Product|Interest/);
});
