import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import webPush from 'web-push';
import { audit, publicUser } from './db.mjs';
import { clearSessionCookie, hashPassword, parseCookies, randomToken, sessionCookie, tokenHash, validPassword, verifyPassword } from './security.mjs';
import { createMilkFeed } from './milk.mjs';
import { registerVisit } from './visits.mjs';

export const ICONS = new Set(['calculator','list-tree','refresh-cw','presentation','truck','building-2','images','wrench','file-text','folder-open','link-2','book-open','globe','phone','mail','video','chart-no-axes-combined','package','settings','users']);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_DIR = resolve(import.meta.dirname, '../public');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const bad = message => { throw new HttpError(400, message); };
const need = (condition, status = 403, message = 'Nicht erlaubt') => { if (!condition) throw new HttpError(status, message); };
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const flag = value => value === true || value === 1;
const now = () => new Date().toISOString();

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

async function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'JSON erwartet');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw new HttpError(413, 'Anfrage zu groß');
  }
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') bad('Ungültiges JSON');
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    bad('Ungültiges JSON');
  }
}

function linkInput(data) {
  const titleDe = clean(data.titleDe, 100);
  const titleEn = clean(data.titleEn, 100);
  if (!titleDe || !titleEn) bad('Bezeichnung DE und EN sind erforderlich');
  const icon = clean(data.icon, 50);
  if (!ICONS.has(icon)) bad('Icon nicht erlaubt');
  const url = clean(data.url, 2000);
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) bad('Nur HTTP(S)-Links ohne Zugangsdaten sind erlaubt');
    } catch (error) {
      if (error instanceof HttpError) throw error;
      bad('Ungültige URL');
    }
  }
  const position = Number(data.position);
  if (!Number.isInteger(position) || position < 0 || position > 100000) bad('Ungültige Reihenfolge');
  if (data.parentId !== undefined && data.parentId !== null && data.parentId !== '' &&
    (typeof data.parentId !== 'string' || !data.parentId.trim() || data.parentId.length > 100)) bad('Ungültige Kategorie');
  return {
    parentId: data.parentId == null || data.parentId === '' ? null : clean(data.parentId, 100),
    titleDe, titleEn,
    descriptionDe: clean(data.descriptionDe, 180),
    descriptionEn: clean(data.descriptionEn, 180),
    url, icon,
    audienceStaff: flag(data.audienceStaff) ? 1 : 0,
    audienceDealer: flag(data.audienceDealer) ? 1 : 0,
    active: flag(data.active) ? 1 : 0,
    featured: flag(data.featured) ? 1 : 0,
    position
  };
}

function checkHierarchy(db, id, parentId) {
  const pairs = db.prepare('SELECT id,parent_id FROM links').all();
  const parents = new Map(pairs.map(row => [row.id, row.parent_id]));
  parents.set(id, parentId);
  for (const start of parents.keys()) {
    let cursor = start;
    const seen = new Set();
    while (cursor) {
      if (!parents.has(cursor)) bad('Übergeordnete Kategorie nicht gefunden');
      if (seen.has(cursor)) bad('Kategorien dürfen keinen Kreis bilden');
      seen.add(cursor);
      if (seen.size > 3) bad('Maximal drei Kategorieebenen');
      cursor = parents.get(cursor);
    }
  }
  if (parentId && db.prepare('SELECT url FROM links WHERE id=?').get(parentId)?.url) bad('Ein direkter Link kann keine Unterpunkte enthalten');
}

function linkRow(row) {
  return {
    id: row.id, parentId: row.parent_id, titleDe: row.title_de, titleEn: row.title_en,
    descriptionDe: row.description_de, descriptionEn: row.description_en,
    url: row.url, icon: row.icon, audienceStaff: Boolean(row.audience_staff),
    audienceDealer: Boolean(row.audience_dealer), active: Boolean(row.active),
    featured: Boolean(row.featured), position: row.position
  };
}

function messageRow(row) {
  return {
    id: row.id, titleDe: row.title_de, titleEn: row.title_en,
    bodyDe: row.body_de, bodyEn: row.body_en,
    audience: row.audience, status: row.status,
    createdAt: row.created_at, publishedAt: row.published_at,
    readAt: row.read_at || null
  };
}

export function createApp({ db, config = process.env } = {}) {
  if (!db) throw new Error('Database required');
  const origin = new URL(config.PUBLIC_ORIGIN || 'http://localhost:3000').origin;
  const secure = origin.startsWith('https:');
  const milk = createMilkFeed(config, fetch, db);
  const pushEnabled = Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY && config.VAPID_SUBJECT);
  if (pushEnabled) webPush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);

  function session(req) {
    const token = parseCookies(req.headers.cookie).bvl_session;
    if (!token || token.length > 100) return null;
    return db.prepare(`SELECT u.*,s.token_hash AS session_hash,s.csrf_token AS session_csrf
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).get(tokenHash(token), now()) || null;
  }

  function authenticated(req) {
    const user = session(req);
    need(user, 401, 'Bitte anmelden');
    return user;
  }

  function writeAllowed(req, user = null) {
    need(req.headers.origin === origin, 403, 'Ungültige Herkunft');
    if (user) need(req.headers['x-csrf-token'] === user.session_csrf, 403, 'Ungültiges Sicherheitstoken');
  }

  function portalLinks(user) {
    const rows = db.prepare('SELECT * FROM links WHERE active=1 ORDER BY position,id').all();
    const visible = rows.filter(row => user.role === 'admin' || (user.role === 'dealer' ? row.audience_dealer : row.audience_staff));
    const ids = new Set(visible.map(row => row.id));
    return visible.filter(row => !row.parent_id || ids.has(row.parent_id)).map(linkRow);
  }

  function visibleMessages(user) {
    return db.prepare(`SELECT m.*,r.read_at FROM messages m
      LEFT JOIN message_reads r ON r.message_id=m.id AND r.user_id=?
      WHERE m.status='published' AND (
        ?='admin' OR m.audience='all' OR
        (m.audience='staff' AND ?='staff') OR
        (m.audience='dealer' AND ?='dealer') OR
        (m.audience='selected' AND EXISTS (
          SELECT 1 FROM message_targets t WHERE t.message_id=m.id AND t.user_id=?
        ))
      ) ORDER BY m.published_at DESC LIMIT 100`).all(user.id, user.role, user.role, user.role, user.id).map(messageRow);
  }

  async function sendPush(message) {
    if (!pushEnabled) return { sent: 0, failed: 0, configured: false };
    const recipients = db.prepare(`SELECT p.*,u.language,u.role FROM push_subscriptions p
      JOIN users u ON u.id=p.user_id WHERE u.active=1 AND (
        ?='all' OR (?='staff' AND u.role IN ('staff','admin')) OR
        (?='dealer' AND u.role IN ('dealer','admin')) OR
        (?='selected' AND EXISTS (SELECT 1 FROM message_targets t WHERE t.message_id=? AND t.user_id=u.id))
      )`).all(message.audience, message.audience, message.audience, message.audience, message.id);
    const results = await Promise.allSettled(recipients.map(async recipient => {
      const payload = JSON.stringify({
        title: recipient.language === 'en' ? message.title_en : message.title_de,
        body: recipient.language === 'en' ? message.body_en : message.body_de,
        url: `/#/messages/${message.id}`
      });
      try {
        await webPush.sendNotification({ endpoint: recipient.endpoint, keys: { p256dh: recipient.p256dh, auth: recipient.auth } }, payload, { TTL: 86400, timeout: 10000 });
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(recipient.endpoint);
        throw error;
      }
    }));
    return { sent: results.filter(item => item.status === 'fulfilled').length, failed: results.filter(item => item.status === 'rejected').length, configured: true };
  }

  async function api(req, res, pathname) {
    const method = req.method;
    if (method === 'GET' && pathname === '/api/session') {
      const user = authenticated(req);
      return json(res, 200, { user: publicUser(user), csrfToken: user.session_csrf, pushEnabled, vapidPublicKey: pushEnabled ? config.VAPID_PUBLIC_KEY : null });
    }
    if (method === 'POST' && pathname === '/api/login') {
      writeAllowed(req);
      const data = await body(req);
      const username = clean(data.username, 80);
      const password = typeof data.password === 'string' ? data.password : '';
      const attemptKey = tokenHash(`${req.socket.remoteAddress || ''}:${username.toLowerCase()}`);
      const attempt = db.prepare('SELECT * FROM login_attempts WHERE key=?').get(attemptKey);
      if (attempt?.blocked_until && attempt.blocked_until > now()) throw new HttpError(429, 'Zu viele Versuche. Bitte später erneut versuchen.');
      const user = db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1').get(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        const count = attempt && Date.now() - Date.parse(attempt.window_start) < 15 * 60000 ? attempt.count + 1 : 1;
        const blockedUntil = count >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
        db.prepare(`INSERT INTO login_attempts(key,count,window_start,blocked_until) VALUES (?,?,?,?)
          ON CONFLICT(key) DO UPDATE SET count=excluded.count,window_start=excluded.window_start,blocked_until=excluded.blocked_until`)
          .run(attemptKey, count, count === 1 ? now() : attempt.window_start, blockedUntil);
        throw new HttpError(401, 'Anmeldedaten ungültig');
      }
      db.prepare('DELETE FROM login_attempts WHERE key=?').run(attemptKey);
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
      const token = randomToken();
      const csrf = randomToken();
      db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
        .run(tokenHash(token), user.id, csrf, new Date(Date.now() + SESSION_MS).toISOString(), now());
      db.prepare('UPDATE users SET last_login_at=? WHERE id=?').run(now(), user.id);
      audit(db, user.id, 'login', user.id);
      return json(res, 200, { user: publicUser(user), csrfToken: csrf, pushEnabled, vapidPublicKey: pushEnabled ? config.VAPID_PUBLIC_KEY : null }, { 'Set-Cookie': sessionCookie(token, secure) });
    }

    const user = authenticated(req);
    if (!['GET', 'HEAD'].includes(method)) writeAllowed(req, user);

    if (method === 'POST' && pathname === '/api/logout') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.session_hash);
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(secure) });
    }
    if (method === 'GET' && pathname === '/api/portal') {
      const lead = db.prepare('SELECT * FROM lead_times WHERE id=1').get();
      const links = portalLinks(user);
      const messages = visibleMessages(user);
      const visitorCount = registerVisit(db, user.session_hash).total;
      return json(res, 200, {
        links,
        leadTimes: { towedWeeks: lead.towed_weeks, selfWeeks: lead.self_weeks, updatedAt: lead.updated_at },
        milkPrice: milk.current(), messages, visitorCount
      });
    }
    if (method === 'PATCH' && pathname === '/api/profile') {
      const data = await body(req);
      need(['de', 'en'].includes(data.language), 400, 'Sprache ungültig');
      db.prepare('UPDATE users SET language=?,updated_at=? WHERE id=?').run(data.language, now(), user.id);
      return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
    }
    if (method === 'POST' && pathname === '/api/profile/password') {
      const data = await body(req);
      need(verifyPassword(data.currentPassword || '', user.password_hash), 400, 'Aktuelles Passwort ungültig');
      need(validPassword(data.newPassword), 400, 'Neues Passwort muss 12 bis 256 Zeichen haben');
      db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hashPassword(data.newPassword), now(), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, user.session_hash);
      audit(db, user.id, 'password.change', user.id);
      return json(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/messages') return json(res, 200, { messages: visibleMessages(user) });
    const readMatch = pathname.match(/^\/api\/messages\/([^/]+)\/read$/);
    if (method === 'POST' && readMatch) {
      const found = visibleMessages(user).find(item => item.id === readMatch[1]);
      need(found, 404, 'Mitteilung nicht gefunden');
      db.prepare('INSERT OR REPLACE INTO message_reads(message_id,user_id,read_at) VALUES (?,?,?)').run(found.id, user.id, now());
      return json(res, 200, { ok: true });
    }
    if (method === 'POST' && pathname === '/api/push-subscriptions') {
      need(pushEnabled, 503, 'Push ist noch nicht eingerichtet');
      const data = await body(req);
      const endpoint = clean(data.endpoint, 2000);
      need(endpoint.startsWith('https://') && endpoint.length > 30, 400, 'Ungültiges Push-Abonnement');
      need(typeof data.keys?.p256dh === 'string' && typeof data.keys?.auth === 'string', 400, 'Push-Schlüssel fehlen');
      db.prepare(`INSERT INTO push_subscriptions(endpoint,user_id,session_hash,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,p256dh=excluded.p256dh,auth=excluded.auth`)
        .run(endpoint, user.id, user.session_hash, data.keys.p256dh, data.keys.auth, now());
      return json(res, 201, { ok: true });
    }
    if (method === 'DELETE' && pathname === '/api/push-subscriptions') {
      const data = await body(req);
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').run(clean(data.endpoint, 2000), user.id);
      return json(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/api/admin/lead-times') {
      need(user.role === 'admin' || user.can_edit_lead_times);
      return json(res, 200, { leadTimes: db.prepare('SELECT * FROM lead_times WHERE id=1').get() });
    }
    if (method === 'PUT' && pathname === '/api/admin/lead-times') {
      need(user.role === 'admin' || user.can_edit_lead_times);
      const data = await body(req);
      need(Number.isInteger(data.towedWeeks) && data.towedWeeks >= 1 && data.towedWeeks <= 52 &&
        Number.isInteger(data.selfWeeks) && data.selfWeeks >= 1 && data.selfWeeks <= 52, 400, 'Bitte ganze Wochenwerte von 1 bis 52 eingeben');
      db.prepare('UPDATE lead_times SET towed_weeks=?,self_weeks=?,updated_at=?,updated_by=? WHERE id=1')
        .run(data.towedWeeks, data.selfWeeks, now(), user.id);
      audit(db, user.id, 'lead_times.update', '1');
      return json(res, 200, { leadTimes: db.prepare('SELECT * FROM lead_times WHERE id=1').get() });
    }

    need(user.role === 'admin');
    if (method === 'GET' && pathname === '/api/admin/overview') {
      return json(res, 200, {
        users: db.prepare('SELECT COUNT(*) AS n FROM users WHERE active=1').get().n,
        links: db.prepare('SELECT COUNT(*) AS n FROM links').get().n,
        messages: db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status='published'").get().n,
        leadTimes: db.prepare('SELECT * FROM lead_times WHERE id=1').get()
      });
    }
    if (method === 'GET' && pathname === '/api/admin/links') {
      return json(res, 200, { links: db.prepare('SELECT * FROM links ORDER BY position,id').all().map(linkRow) });
    }
    if (method === 'POST' && pathname === '/api/admin/links') {
      const data = linkInput(await body(req));
      const id = randomUUID();
      checkHierarchy(db, id, data.parentId);
      db.prepare(`INSERT INTO links (id,parent_id,title_de,title_en,description_de,description_en,url,icon,audience_staff,audience_dealer,active,featured,position,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.parentId, data.titleDe, data.titleEn, data.descriptionDe, data.descriptionEn, data.url,
          data.icon, data.audienceStaff, data.audienceDealer, data.active, data.featured, data.position, now(), now());
      audit(db, user.id, 'link.create', id);
      return json(res, 201, { link: linkRow(db.prepare('SELECT * FROM links WHERE id=?').get(id)) });
    }
    const linkMatch = pathname.match(/^\/api\/admin\/links\/([^/]+)$/);
    if (linkMatch && method === 'PUT') {
      need(db.prepare('SELECT 1 FROM links WHERE id=?').get(linkMatch[1]), 404, 'Link nicht gefunden');
      const data = linkInput(await body(req));
      checkHierarchy(db, linkMatch[1], data.parentId);
      if (data.url && db.prepare('SELECT 1 FROM links WHERE parent_id=?').get(linkMatch[1])) bad('Kategorie mit Unterpunkten kann keine direkte URL erhalten');
      db.prepare(`UPDATE links SET parent_id=?,title_de=?,title_en=?,description_de=?,description_en=?,url=?,icon=?,
        audience_staff=?,audience_dealer=?,active=?,featured=?,position=?,updated_at=? WHERE id=?`)
        .run(data.parentId, data.titleDe, data.titleEn, data.descriptionDe, data.descriptionEn, data.url,
          data.icon, data.audienceStaff, data.audienceDealer, data.active, data.featured, data.position, now(), linkMatch[1]);
      audit(db, user.id, 'link.update', linkMatch[1]);
      return json(res, 200, { link: linkRow(db.prepare('SELECT * FROM links WHERE id=?').get(linkMatch[1])) });
    }
    if (linkMatch && method === 'DELETE') {
      need(db.prepare('SELECT 1 FROM links WHERE id=?').get(linkMatch[1]), 404, 'Link nicht gefunden');
      need(!db.prepare('SELECT 1 FROM links WHERE parent_id=?').get(linkMatch[1]), 409, 'Zuerst Unterpunkte entfernen');
      db.prepare('DELETE FROM links WHERE id=?').run(linkMatch[1]);
      audit(db, user.id, 'link.delete', linkMatch[1]);
      return json(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/admin/users') {
      return json(res, 200, { users: db.prepare('SELECT * FROM users ORDER BY display_name').all().map(publicUser) });
    }
    if (method === 'POST' && pathname === '/api/admin/users') {
      const data = await body(req);
      const username = clean(data.username, 80);
      const displayName = clean(data.displayName, 100);
      need(username.length >= 3 && displayName && validPassword(data.password) && ['admin','staff','dealer'].includes(data.role), 400, 'Benutzerdaten ungültig');
      const id = randomUUID();
      try {
        db.prepare(`INSERT INTO users (id,username,display_name,password_hash,role,can_edit_lead_times,active,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)`).run(id, username, displayName, hashPassword(data.password), data.role,
            flag(data.canEditLeadTimes) ? 1 : 0, 1, now(), now());
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'Benutzername bereits vergeben');
        throw error;
      }
      audit(db, user.id, 'user.create', id);
      return json(res, 201, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
    }
    const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === 'PUT') {
      const target = db.prepare('SELECT * FROM users WHERE id=?').get(userMatch[1]);
      need(target, 404, 'Benutzer nicht gefunden');
      const data = await body(req);
      const displayName = clean(data.displayName, 100);
      need(displayName && ['admin','staff','dealer'].includes(data.role), 400, 'Benutzerdaten ungültig');
      const active = flag(data.active) ? 1 : 0;
      if (target.id === user.id && (!active || data.role !== 'admin')) throw new HttpError(400, 'Eigenen Adminzugang nicht entziehen');
      if (target.role === 'admin' && (data.role !== 'admin' || !active)) {
        need(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get().n > 1, 400, 'Letzter Admin darf nicht deaktiviert werden');
      }
      if (data.password !== undefined) need(validPassword(data.password), 400, 'Passwort muss 12 bis 256 Zeichen haben');
      db.prepare(`UPDATE users SET display_name=?,role=?,can_edit_lead_times=?,active=?,password_hash=?,updated_at=? WHERE id=?`)
        .run(displayName, data.role, flag(data.canEditLeadTimes) ? 1 : 0, active,
          data.password === undefined ? target.password_hash : hashPassword(data.password), now(), target.id);
      if (!active || data.password !== undefined || data.role !== target.role) db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      audit(db, user.id, 'user.update', target.id);
      return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(target.id)) });
    }
    if (userMatch && method === 'DELETE') {
      need(userMatch[1] !== user.id, 400, 'Eigenen Zugang nicht löschen');
      const target = db.prepare('SELECT * FROM users WHERE id=?').get(userMatch[1]);
      need(target, 404, 'Benutzer nicht gefunden');
      if (target.role === 'admin' && target.active) need(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get().n > 1, 400, 'Letzter Admin darf nicht gelöscht werden');
      db.prepare('DELETE FROM users WHERE id=?').run(target.id);
      audit(db, user.id, 'user.delete', target.id);
      return json(res, 200, { ok: true });
    }
    if (method === 'GET' && pathname === '/api/admin/messages') {
      const rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').all();
      return json(res, 200, { messages: rows.map(row => ({ ...messageRow(row), targetIds: db.prepare('SELECT user_id FROM message_targets WHERE message_id=?').all(row.id).map(item => item.user_id) })) });
    }
    if (method === 'POST' && pathname === '/api/admin/messages') {
      const data = await body(req);
      const titleDe = clean(data.titleDe, 120), titleEn = clean(data.titleEn, 120);
      const bodyDe = clean(data.bodyDe, 1200), bodyEn = clean(data.bodyEn, 1200);
      const audience = clean(data.audience, 20);
      need(titleDe && titleEn && bodyDe && bodyEn && ['all','staff','dealer','selected'].includes(audience), 400, 'Mitteilung unvollständig');
      const targets = Array.isArray(data.targetIds) ? [...new Set(data.targetIds.filter(id => typeof id === 'string'))] : [];
      if (audience === 'selected') {
        need(targets.length > 0, 400, 'Empfänger fehlen');
        for (const id of targets) need(db.prepare('SELECT 1 FROM users WHERE id=? AND active=1').get(id), 400, 'Empfänger ungültig');
      }
      const id = randomUUID(), created = now();
      const status = data.publish === true ? 'published' : 'draft';
      db.exec('BEGIN');
      try {
        db.prepare(`INSERT INTO messages(id,title_de,title_en,body_de,body_en,audience,status,created_at,published_at,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, titleDe, titleEn, bodyDe, bodyEn, audience, status, created, status === 'published' ? created : null, user.id);
        if (audience === 'selected') for (const targetId of targets) db.prepare('INSERT INTO message_targets(message_id,user_id) VALUES (?,?)').run(id, targetId);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      audit(db, user.id, 'message.create', id);
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
      const push = status === 'published' ? await sendPush(row) : null;
      return json(res, 201, { message: messageRow(row), push });
    }
    const publishMatch = pathname.match(/^\/api\/admin\/messages\/([^/]+)\/publish$/);
    if (method === 'POST' && publishMatch) {
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(publishMatch[1]);
      need(row, 404, 'Mitteilung nicht gefunden');
      need(row.status === 'draft', 409, 'Bereits veröffentlicht');
      db.prepare("UPDATE messages SET status='published',published_at=? WHERE id=?").run(now(), row.id);
      audit(db, user.id, 'message.publish', row.id);
      const published = db.prepare('SELECT * FROM messages WHERE id=?').get(row.id);
      return json(res, 200, { message: messageRow(published), push: await sendPush(published) });
    }
    throw new HttpError(404, 'Nicht gefunden');
  }

  async function staticFile(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Methode nicht erlaubt');
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { throw new HttpError(400, 'Ungültiger Pfad'); }
    const file = resolve(PUBLIC_DIR, `.${decoded === '/' ? '/index.html' : decoded}`);
    const rel = relative(PUBLIC_DIR, file);
    need(rel && !rel.startsWith(`..${sep}`) && rel !== '..', 404, 'Nicht gefunden');
    const info = await stat(file).catch(() => null);
    need(info?.isFile(), 404, 'Nicht gefunden');
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': content.length
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  }

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    try {
      const pathname = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, { ok: true });
      if (pathname.startsWith('/api/')) return await api(req, res, pathname);
      return await staticFile(req, res, pathname);
    } catch (error) {
      if (res.headersSent) return res.end();
      if (!(error instanceof HttpError)) console.error('Server error:', error);
      json(res, error.status || 500, { error: error.status ? error.message : 'Interner Fehler' });
    }
  });
  return { server, milk };
}
