import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(file = process.env.DATABASE_FILE || resolve(process.env.DATA_DIR || './data', 'sales.sqlite')) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','staff','dealer')),
      language TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de','en')),
      can_edit_lead_times INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS visitor_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0)
    );
    INSERT OR IGNORE INTO visitor_counter(id,total) VALUES (1,0);
    CREATE TABLE IF NOT EXISTS visit_sessions (
      session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start TEXT NOT NULL,
      blocked_until TEXT
    );
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES links(id) ON DELETE RESTRICT,
      title_de TEXT NOT NULL,
      title_en TEXT NOT NULL,
      description_de TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL,
      audience_staff INTEGER NOT NULL DEFAULT 1,
      audience_dealer INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_links_parent_position ON links(parent_id, position);
    CREATE TABLE IF NOT EXISTS lead_times (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      towed_weeks INTEGER CHECK (towed_weeks BETWEEN 1 AND 52),
      self_weeks INTEGER CHECK (self_weeks BETWEEN 1 AND 52),
      updated_at TEXT,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );
    INSERT OR IGNORE INTO lead_times(id) VALUES (1);
    CREATE TABLE IF NOT EXISTS milk_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value_ct_per_kg REAL NOT NULL,
      period TEXT NOT NULL,
      end_date TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      title_de TEXT NOT NULL,
      title_en TEXT NOT NULL,
      body_de TEXT NOT NULL,
      body_en TEXT NOT NULL,
      audience TEXT NOT NULL CHECK (audience IN ('all','staff','dealer','selected')),
      status TEXT NOT NULL CHECK (status IN ('draft','published')),
      created_at TEXT NOT NULL,
      published_at TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS message_targets (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
  seedLinks(db);
  return db;
}

function seedLinks(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM links').get().n) return;
  const now = new Date().toISOString();
  const links = [
    ['offer', null, 'Angebotstool', 'Quotation tool', 'Neues Angebot erstellen', 'Create a new quotation', 'https://www.offer.bvl-farmtechnology.com/login', 'calculator', 1, 1, 1, 1, 10],
    ['prices', null, 'Preislisten', 'Price lists', 'Sprachversion wählen', 'Choose a language', '', 'list-tree', 1, 1, 1, 0, 20],
    ['price-de', 'prices', 'Deutsch', 'German', '', '', 'https://bvl-group.canto.de/v/sales/s/RBHB3', 'file-text', 1, 1, 1, 0, 10],
    ['price-nl', 'prices', 'Niederländisch', 'Dutch', '', '', 'https://bvl-group.canto.de/b/GO7HU', 'file-text', 1, 1, 1, 0, 20],
    ['used', null, 'Gebrauchtmaschinen', 'Used machinery', '', '', 'https://gebrauchtmaschinen.bvlki.cloud/', 'refresh-cw', 1, 1, 1, 0, 30],
    ['vmix', null, 'V-MIX', 'V-MIX', 'Unterlagen', 'Documents', 'https://bvl-group.canto.de/v/sales/s/IU79R', 'presentation', 1, 1, 1, 0, 40],
    ['drive', null, 'V-MIX Drive', 'V-MIX Drive', 'Unterlagen', 'Documents', 'https://bvl-group.canto.de/v/sales/s/IHR8E', 'truck', 1, 1, 1, 0, 50],
    ['company', null, 'BvL Company', 'BvL Company', '', '', 'https://bvl-group.canto.de/v/sales/s/QPTD8', 'building-2', 1, 1, 1, 0, 60],
    ['canto', null, 'Canto Media', 'Canto Media', 'Mediathek', 'Media library', 'https://bvl-group.canto.de/', 'images', 1, 1, 1, 0, 70],
    ['service', null, 'Service & Support', 'Service & support', 'Kontakte und Unterlagen', 'Contacts and documents', '', 'wrench', 1, 1, 0, 0, 80]
  ];
  const insert = db.prepare(`INSERT INTO links
    (id,parent_id,title_de,title_en,description_de,description_en,url,icon,audience_staff,audience_dealer,active,featured,position,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    for (const row of links) insert.run(...row, now, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function audit(db, actorId, action, targetId = null) {
  db.prepare('INSERT INTO audit_log (actor_id,action,target_id,created_at) VALUES (?,?,?,?)')
    .run(actorId, action, targetId, new Date().toISOString());
}

export function publicUser(row) {
  return row && {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    language: row.language,
    canEditLeadTimes: row.role === 'admin' || Boolean(row.can_edit_lead_times),
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}
