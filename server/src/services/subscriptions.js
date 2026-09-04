import db from '../db/index.js';
import { parseICS } from '../lib/ics.js';

// ICS calendar subscriptions: fetch a public .ics URL, parse it, and merge its
// VEVENTs into the events table read-only (source='ics'). Mirrors the Google
// auto-sync pattern: best-effort, non-fatal, dedupes via the existing unique
// (google_cal_id, google_id) index by reusing those columns.
//
//   google_cal_id = 'ics:<subscriptionId>'   (namespaced so it never collides)
//   google_id     = the ICS UID

// Only allow http(s) URLs; block SSRF-ish local addresses.
export function validateUrl(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  // Providers publish webcal:// links; normalize to https for fetching.
  if (u.protocol === 'webcal:') {
    u.protocol = 'https:';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'URL must be http(s) or webcal' };
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return { ok: false, error: 'Local addresses are not allowed' };
  }
  return { ok: true, url: u.toString() };
}

function calKey(subId) {
  return `ics:${subId}`;
}

// Prepared lazily (after migrations have created the events table). Mirrors the
// Google service, which also prepares its statements inside the sync function.
function upsertStmt() {
  return db.prepare(
    `INSERT INTO events (title, description, location, start, "end", all_day, source, google_id, google_cal_id, color, updated_at)
     VALUES (@title,@description,@location,@start,@end,@all_day,'ics',@uid,@cal_id,@color,datetime('now'))
     ON CONFLICT(google_cal_id, google_id) WHERE google_id IS NOT NULL DO UPDATE SET
       title=excluded.title, description=excluded.description, location=excluded.location,
       start=excluded.start, "end"=excluded."end", all_day=excluded.all_day,
       color=excluded.color, updated_at=datetime('now')`
  );
}

// Sync a single subscription row. Returns { synced } or { error }.
export async function syncSubscription(sub, { timeoutMs = 15000 } = {}) {
  const v = validateUrl(sub.url);
  if (!v.ok) {
    db.prepare(
      `UPDATE calendar_subscriptions SET last_error=?, updated_at=datetime('now') WHERE id=?`
    ).run(v.error, sub.id);
    return { id: sub.id, error: v.error };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(v.url, {
      signal: controller.signal,
      headers: { Accept: 'text/calendar, text/plain, */*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const parsed = parseICS(body);

    const calId = calKey(sub.id);
    const upsert = upsertStmt();
    const seen = new Set();
    const tx = db.transaction(() => {
      for (const ev of parsed) {
        upsert.run({
          title: ev.title,
          description: ev.description,
          location: ev.location,
          start: ev.start,
          end: ev.end,
          all_day: ev.allDay ? 1 : 0,
          uid: ev.uid,
          cal_id: calId,
          color: sub.color || null,
        });
        seen.add(ev.uid);
      }
      // Remove events for this subscription that vanished upstream.
      const existing = db
        .prepare("SELECT id, google_id FROM events WHERE source='ics' AND google_cal_id=?")
        .all(calId);
      const del = db.prepare('DELETE FROM events WHERE id=?');
      for (const row of existing) if (!seen.has(row.google_id)) del.run(row.id);
    });
    tx();

    db.prepare(
      `UPDATE calendar_subscriptions SET last_synced=datetime('now'), last_error=NULL,
       updated_at=datetime('now') WHERE id=?`
    ).run(sub.id);
    return { id: sub.id, synced: parsed.length };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Fetch timed out' : err.message || 'Fetch failed';
    db.prepare(
      `UPDATE calendar_subscriptions SET last_error=?, updated_at=datetime('now') WHERE id=?`
    ).run(msg, sub.id);
    return { id: sub.id, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// Sync all enabled subscriptions. Never throws.
export async function syncAllSubscriptions() {
  const subs = db.prepare('SELECT * FROM calendar_subscriptions WHERE enabled = 1').all();
  const results = [];
  for (const sub of subs) {
    try {
      results.push(await syncSubscription(sub));
    } catch (e) {
      results.push({ id: sub.id, error: e.message });
    }
  }
  return { count: results.length, results, lastSync: new Date().toISOString() };
}

// Remove all events belonging to a subscription (used on delete).
export function purgeSubscriptionEvents(subId) {
  db.prepare("DELETE FROM events WHERE source='ics' AND google_cal_id=?").run(calKey(subId));
}
