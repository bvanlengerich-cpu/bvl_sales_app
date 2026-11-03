import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBusinessCardFields } from '../server/business-card-fields.mjs';

const line = (text, x, y, width = 600, height = 30, score = .98) => ({ text, score, box: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] });

test('inline phone, fax, mobile and email are separated without copying unrelated text', () => {
  const { fields } = extractBusinessCardFields([
    'Name: Max Mustermann', 'Firma: Muster Maschinen GmbH',
    'Tel.: +49 5903 123456 | Fax: +49 5903 999999 | Mobil: +49 171 1234567',
    'Telefon: +49 5903 123456 E-Mail: max.muster@example.com Web: www.example.com',
    'Musterstraße 12a, D-48488 Emsbüren'
  ]);
  assert.deepEqual(fields, {
    email: 'max.muster@example.com', phone: '+49 5903 123456', mobile: '+49 171 1234567',
    company: 'Muster Maschinen GmbH', street: 'Musterstraße 12a', postalCode: '48488', city: 'Emsbüren', name: 'Max Mustermann'
  });
  assert.doesNotMatch(fields.phone, /Fax|Mobil|@|999999/);
});

test('labels with single-letter prefixes stay distinct and phone fields contain only numbers', () => {
  const { fields } = extractBusinessCardFields('T: +49 (0) 30 123456-7 F: +49 (0) 30 999999 M: 0171 1234567 E: max@example.de');
  assert.equal(fields.phone, '+49 (0) 30 123456-7');
  assert.equal(fields.mobile, '0171 1234567');
  assert.equal(fields.email, 'max@example.de');
});

test('legal company and neighbouring job title identify a person despite a slogan appearing first', () => {
  const { fields } = extractBusinessCardFields([
    line('Ihr Partner für innovative Landtechnik', 0, 0, 800, 45),
    line('Muster Maschinen GmbH', 0, 80, 750, 50),
    line('Dr. Max Mustermann', 0, 170, 650, 44),
    line('Vertriebsleiter', 0, 225, 400, 26),
    line('max.mustermann@example.com', 0, 320),
    line('+49 5903 123456', 0, 370), line('0171 1234567', 0, 420),
    line('Hauptstr. 12', 0, 470), line('48488 Emsbüren', 0, 520)
  ]);
  assert.equal(fields.name, 'Dr. Max Mustermann');
  assert.equal(fields.company, 'Muster Maschinen GmbH');
  assert.equal(fields.street, 'Hauptstr. 12');
  assert.equal(fields.phone, '+49 5903 123456');
  assert.equal(fields.mobile, '0171 1234567');
});

test('multi-column contacts use personal-email evidence and preserve the Dutch postal code', () => {
  const { fields } = extractBusinessCardFields([
    line('Example B.V.', 0, 0), line('Jane van Dijk', 0, 100), line('Tom Jansen', 800, 100),
    line('Account Manager', 0, 145), line('Sales Director', 800, 145),
    line('jane.vandijk@example.nl', 0, 200), line('Street: Dorpsstraat 12', 0, 250), line('1234 AB Amsterdam', 0, 290),
    line('Mobil: +31 6 12345678', 0, 330)
  ]);
  assert.equal(fields.name, 'Jane van Dijk');
  assert.equal(fields.company, 'Example B.V.');
  assert.equal(fields.postalCode, '1234 AB');
  assert.equal(fields.city, 'Amsterdam');
  assert.equal(fields.street, 'Dorpsstraat 12');
  assert.equal(fields.mobile, '+31 6 12345678');
});

test('multiple equally plausible people, emails and phone numbers remain unassigned', () => {
  const { fields, warnings } = extractBusinessCardFields([
    'Example GmbH', 'Max Mustermann', 'Jane Smith',
    'max@example.com jane@example.com', 'Tel: +49 30 123456 | +49 40 123456',
    'VAT: DE123456789', 'Fax: +49 30 999999'
  ]);
  assert.equal(fields.name, undefined);
  assert.equal(fields.email, undefined);
  assert.equal(fields.phone, undefined);
  assert.equal(fields.mobile, undefined);
  assert.ok(warnings.length >= 3);
});

test('poor recognition and slogans cannot silently become contact fields', () => {
  const { fields } = extractBusinessCardFields([
    line('Badly Read Name', 0, 0, 400, 40, .3),
    line('Mobil: +49 171 1234567', 0, 100, 600, 30, .2),
    'QUALITY AND INNOVATION', 'Reliable Farming Solutions', 'Blue Sky', 'hello@example.com',
    'Kundennummer 0123456789', '2026-11-02', '02-11-2026'
  ]);
  assert.deepEqual(fields, { email: 'hello@example.com' });
});

test('same phone number is not proposed in both phone fields', () => {
  const { fields, warnings } = extractBusinessCardFields('Tel: +49 171 1234567 Mobil: +49 171 1234567');
  assert.equal(fields.phone, undefined);
  assert.equal(fields.mobile, '+49 171 1234567');
  assert.equal(warnings.length, 1);
});

test('German geographic numbers are not mistaken for French or Dutch mobile numbers', () => {
  const { fields } = extractBusinessCardFields('0711 1234567');
  assert.equal(fields.phone, '0711 1234567');
  assert.equal(fields.mobile, undefined);
});

test('English and French addresses are extracted without absorbing adjacent email fields', () => {
  const english = extractBusinessCardFields('Name: Jane Smith\nCompany: Example Ltd\n12 Main Street, 12345 Sample City\nPhone: 555 123 4567 Email: jane@example.org').fields;
  assert.equal(english.street, '12 Main Street');
  assert.equal(english.city, 'Sample City');
  assert.equal(english.phone, '555 123 4567');
  const french = extractBusinessCardFields('Nom inconnu\nSociété SARL\n12 rue de la Paix, 75002 Paris\nMobile: +33 6 12 34 56 78').fields;
  assert.equal(french.street, '12 rue de la Paix');
  assert.equal(french.postalCode, '75002');
  assert.equal(french.city, 'Paris');
  assert.equal(french.mobile, '+33 6 12 34 56 78');
});

test('invalid input and registration or account numbers are ignored', () => {
  assert.deepEqual(extractBusinessCardFields(null), { fields: {}, warnings: [] });
  const { fields } = extractBusinessCardFields(['VAT: 0123456789', 'IBAN DE89 3704 0044 0532 0130 00', 'Tel: 123', 'Tel: 0000000000', null, {}]);
  assert.equal(fields.phone, undefined);
  assert.equal(fields.mobile, undefined);
});

test('numeric email usernames and website paths cannot become phone numbers', () => {
  const { fields } = extractBusinessCardFields(['01711234567@example.com', 'https://example.com/0301234567']);
  assert.equal(fields.email, '01711234567@example.com');
  assert.equal(fields.phone, undefined);
  assert.equal(fields.mobile, undefined);
});

test('unlabelled vertical separators keep a person distinct from the company', () => {
  const { fields } = extractBusinessCardFields('Max Mustermann | Muster GmbH\nPhone: +49 (0)30 1234567 | Phone: +49 30 1234567');
  assert.equal(fields.name, 'Max Mustermann');
  assert.equal(fields.company, 'Muster GmbH');
  assert.ok(fields.phone);
});
