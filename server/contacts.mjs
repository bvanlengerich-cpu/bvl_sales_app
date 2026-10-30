import { createHash } from 'node:crypto';

export class ContactError extends Error {
  constructor(status, message, contact = null) {
    super(message);
    this.status = status;
    this.contact = contact;
  }
}

const invalid = message => { throw new ContactError(400, message); };
const idPattern = /^[A-Za-z0-9._:-]{1,160}$/;
const priorities = new Set(['normal', 'high', 'low']);
const statuses = new Set(['new', 'in_progress', 'done']);
const dataKeys = new Set([
  'name', 'company', 'email', 'phone', 'mobile', 'street', 'postalCode', 'city', 'country',
  'fair', 'fairYear', 'customerLanguage', 'interests', 'requests', 'notes', 'priority',
  'status', 'followUp', 'cows', 'currentMachine', 'machineYear', 'volume', 'purchaseTime'
]);
const interestKeys = new Set(['family', 'model', 'variant', 'detail']);

function string(value, key, max, { required = false, multiline = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max || value.includes('\0') ||
    (!multiline && /[\r\n]/.test(value))) invalid(`Ungültiges Feld: ${key}`);
  const result = value.trim();
  if (required && !result) invalid(`Pflichtfeld fehlt: ${key}`);
  return result;
}

function year(value, key) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  if (!/^(19|20|21)\d{2}$/.test(text)) invalid(`Ungültiges Feld: ${key}`);
  return text;
}

function date(value, key) {
  const text = string(value, key, 10);
  if (text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(Date.parse(`${text}T12:00:00Z`)) ||
    new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) !== text)) invalid(`Ungültiges Feld: ${key}`);
  return text;
}

export function normalizeContactData(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') invalid('Kontaktdaten fehlen');
  if (Object.keys(input).some(key => !dataKeys.has(key))) invalid('Unbekanntes Kontaktfeld');
  const data = {
    name: string(input.name, 'name', 200),
    company: string(input.company, 'company', 200),
    email: string(input.email, 'email', 254),
    phone: string(input.phone, 'phone', 80),
    mobile: string(input.mobile, 'mobile', 80),
    street: string(input.street, 'street', 200),
    postalCode: string(input.postalCode, 'postalCode', 30),
    city: string(input.city, 'city', 160),
    country: string(input.country, 'country', 100),
    fair: string(input.fair, 'fair', 160, { required: true }),
    fairYear: year(input.fairYear, 'fairYear'),
    customerLanguage: string(input.customerLanguage, 'customerLanguage', 16),
    interests: [],
    requests: [],
    notes: string(input.notes, 'notes', 10000, { multiline: true }),
    priority: input.priority ?? 'normal',
    status: input.status ?? 'new',
    followUp: date(input.followUp, 'followUp'),
    cows: string(input.cows, 'cows', 80),
    currentMachine: string(input.currentMachine, 'currentMachine', 200),
    machineYear: year(input.machineYear, 'machineYear'),
    volume: string(input.volume, 'volume', 100),
    purchaseTime: string(input.purchaseTime, 'purchaseTime', 100)
  };
  if (!data.name && !data.company) invalid('Name oder Betrieb ist erforderlich');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) invalid('Ungültige E-Mail-Adresse');
  if (!priorities.has(data.priority)) invalid('Ungültige Priorität');
  if (!statuses.has(data.status)) invalid('Ungültiger Status');
  if (!Array.isArray(input.interests) || input.interests.length > 30) invalid('Ungültige Interessen');
  if (!Array.isArray(input.requests) || input.requests.length > 30) invalid('Ungültige Anfragen');
  data.interests = input.interests.map((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object' ||
      Object.keys(item).some(key => !interestKeys.has(key))) invalid(`Ungültiges Interesse ${index + 1}`);
    return {
      family: string(item.family, 'family', 100),
      model: string(item.model, 'model', 100),
      variant: string(item.variant, 'variant', 100),
      detail: string(item.detail, 'detail', 300)
    };
  });
  data.requests = input.requests.map((item, index) => string(item, `request ${index + 1}`, 120, { required: true }));
  if (Buffer.byteLength(JSON.stringify(data)) > 60000) invalid('Kontaktdaten zu groß');
  return data;
}

function contactRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    revision: row.revision,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: JSON.parse(row.payload)
  };
}

export function listContacts(db, user, scope = null) {
  if (scope !== null && scope !== 'mine') invalid('Ungültiger Kontaktbereich');
  const rows = user.role === 'admin' && scope !== 'mine'
    ? db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC,id').all()
    : db.prepare('SELECT * FROM contacts WHERE owner_id=? ORDER BY updated_at DESC,id').all(user.id);
  return rows.map(contactRow);
}

export function saveContact(db, user, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' ||
    Object.keys(input).some(key => !['id', 'baseRevision', 'mutationId', 'data'].includes(key))) invalid('Ungültige Kontaktanfrage');
  const { id, baseRevision, mutationId } = input;
  if (typeof id !== 'string' || !idPattern.test(id)) invalid('Ungültige Kontakt-ID');
  if (typeof mutationId !== 'string' || !idPattern.test(mutationId)) invalid('Ungültige Änderungs-ID');
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) invalid('Ungültige Revision');
  const data = normalizeContactData(input.data);
  const requestHash = createHash('sha256').update(JSON.stringify({ id, baseRevision, data })).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    const prior = db.prepare('SELECT request_hash,response_json FROM contact_mutations WHERE actor_id=? AND mutation_id=?')
      .get(user.id, mutationId);
    if (prior) {
      if (prior.request_hash !== requestHash) throw new ContactError(409, 'Änderungs-ID bereits verwendet');
      const response = JSON.parse(prior.response_json);
      db.exec('COMMIT');
      return response;
    }
    const existing = db.prepare('SELECT * FROM contacts WHERE id=?').get(id);
    if (existing && user.role !== 'admin' && existing.owner_id !== user.id) {
      throw new ContactError(404, 'Kontakt nicht gefunden');
    }
    if ((existing?.revision || 0) !== baseRevision) {
      throw new ContactError(409, 'Kontakt wurde zwischenzeitlich geändert', contactRow(existing));
    }
    const stamp = new Date().toISOString();
    let record;
    if (existing) {
      db.prepare(`UPDATE contacts SET revision=revision+1,updated_at=?,name=?,company=?,email=?,fair=?,fair_year=?,status=?,priority=?,payload=? WHERE id=? AND revision=?`)
        .run(stamp, data.name, data.company, data.email, data.fair, data.fairYear, data.status, data.priority, JSON.stringify(data), id, baseRevision);
      record = contactRow(db.prepare('SELECT * FROM contacts WHERE id=?').get(id));
    } else {
      db.prepare(`INSERT INTO contacts (id,revision,owner_id,owner_name,created_at,updated_at,name,company,email,fair,fair_year,status,priority,payload)
        VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, user.id, user.display_name, stamp, stamp, data.name, data.company, data.email, data.fair, data.fairYear,
          data.status, data.priority, JSON.stringify(data));
      record = contactRow(db.prepare('SELECT * FROM contacts WHERE id=?').get(id));
    }
    const response = { contact: record };
    db.prepare('INSERT INTO contact_mutations (actor_id,mutation_id,request_hash,response_json,created_at) VALUES (?,?,?,?,?)')
      .run(user.id, mutationId, requestHash, JSON.stringify(response), stamp);
    db.exec('COMMIT');
    return response;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function adminFilters(query) {
  const allowed = new Set(['q', 'fair', 'year', 'status', 'priority', 'ownerId', 'ids']);
  if ([...query.keys()].some(key => !allowed.has(key))) invalid('Unbekannter Filter');
  const q = string(query.get('q'), 'q', 120);
  const fair = string(query.get('fair'), 'fair', 160);
  const yearValue = year(query.get('year'), 'year');
  const status = string(query.get('status'), 'status', 30);
  const priority = string(query.get('priority'), 'priority', 30);
  const ownerId = string(query.get('ownerId'), 'ownerId', 160);
  if (status && !statuses.has(status)) invalid('Ungültiger Statusfilter');
  if (priority && !priorities.has(priority)) invalid('Ungültiger Prioritätsfilter');
  if (ownerId && !idPattern.test(ownerId)) invalid('Ungültiger Bearbeiterfilter');
  const rawIds = query.get('ids');
  const ids = rawIds === null ? null : rawIds.split(',');
  if (ids && (ids.length > 200 || ids.some(id => !idPattern.test(id)))) invalid('Ungültige Kontaktauswahl');
  return { q, fair, year: yearValue, status, priority, ownerId, ids };
}

export function adminContacts(db, query) {
  const filters = adminFilters(query);
  const clauses = [];
  const values = [];
  for (const [column, value] of [
    ['fair', filters.fair], ['fair_year', filters.year], ['status', filters.status],
    ['priority', filters.priority], ['owner_id', filters.ownerId]
  ]) {
    if (value) { clauses.push(`${column}=?`); values.push(value); }
  }
  if (filters.q) {
    clauses.push(`(instr(lower(name),lower(?))>0 OR instr(lower(company),lower(?))>0 OR
      instr(lower(email),lower(?))>0 OR instr(lower(json_extract(payload,'$.city')),lower(?))>0 OR
      instr(lower(json_extract(payload,'$.postalCode')),lower(?))>0)`);
    values.push(filters.q, filters.q, filters.q, filters.q, filters.q);
  }
  if (filters.ids) {
    clauses.push(`id IN (${filters.ids.map(() => '?').join(',')})`);
    values.push(...filters.ids);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const contacts = db.prepare(`SELECT * FROM contacts${where} ORDER BY updated_at DESC,id`).all(...values).map(contactRow);
  const fairs = db.prepare("SELECT DISTINCT fair,fair_year FROM contacts ORDER BY fair COLLATE NOCASE,fair_year DESC").all()
    .map(row => ({ fair: row.fair, year: row.fair_year }));
  const owners = db.prepare('SELECT DISTINCT owner_id,owner_name FROM contacts ORDER BY owner_name COLLATE NOCASE').all()
    .map(row => ({ id: row.owner_id, name: row.owner_name }));
  return { contacts, fairs, owners };
}

const csvHeaders = [
  'ID', 'Erfasst am', 'Aktualisiert am', 'Bearbeiter', 'Messe', 'Messejahr', 'Name', 'Betrieb',
  'E-Mail', 'Telefon', 'Mobil', 'Straße', 'PLZ', 'Ort', 'Land', 'Kundensprache', 'Interesse',
  'Anfragen', 'Notiz', 'Priorität', 'Status', 'Nachfassen', 'Kühe', 'Vorhandene Maschine',
  'Baujahr', 'Volumen', 'Kaufzeitpunkt'
];

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function contactsCsv(contacts) {
  const rows = contacts.map(contact => {
    const d = contact.data;
    return [
      contact.id, contact.createdAt, contact.updatedAt, contact.ownerName, d.fair, d.fairYear,
      d.name, d.company, d.email, d.phone, d.mobile, d.street, d.postalCode, d.city, d.country,
      d.customerLanguage, d.interests.map(item => [item.family, item.model, item.variant, item.detail].filter(Boolean).join(' / ')).join(' | '),
      d.requests.join(' | '), d.notes, d.priority, d.status, d.followUp, d.cows, d.currentMachine,
      d.machineYear, d.volume, d.purchaseTime
    ];
  });
  return `\uFEFF${[csvHeaders, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
