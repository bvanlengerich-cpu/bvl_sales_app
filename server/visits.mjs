export const VISIT_INACTIVITY_MS = 30 * 60 * 1000;

export function registerVisit(db, sessionHash, at = new Date()) {
  const seenAt = at.toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = db.prepare('SELECT last_seen_at FROM visit_sessions WHERE session_hash=?').get(sessionHash);
    const elapsed = previous ? at.getTime() - Date.parse(previous.last_seen_at) : Infinity;
    const counted = !previous || !Number.isFinite(elapsed) || elapsed >= VISIT_INACTIVITY_MS;
    if (counted) db.prepare('UPDATE visitor_counter SET total=total+1 WHERE id=1').run();
    db.prepare(`INSERT INTO visit_sessions(session_hash,last_seen_at) VALUES (?,?)
      ON CONFLICT(session_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at`).run(sessionHash, seenAt);
    const total = db.prepare('SELECT total FROM visitor_counter WHERE id=1').get().total;
    db.exec('COMMIT');
    return { total, counted };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
