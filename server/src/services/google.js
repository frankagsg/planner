import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import config from '../config.js';
import db from '../db/index.js';
import { getSetting } from '../lib/settings.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function newOAuthClient() {
  const { clientId, clientSecret, redirectUri } = config.google;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---- token persistence (chmod 600, never sent to the frontend) ----
export function hasToken() {
  return fs.existsSync(config.google.tokenPath);
}

function loadToken() {
  if (!hasToken()) return null;
  try {
    return JSON.parse(fs.readFileSync(config.google.tokenPath, 'utf8'));
  } catch {
    return null;
  }
}

function saveToken(tokens) {
  const dir = path.dirname(config.google.tokenPath);
  fs.mkdirSync(dir, { recursive: true });
  // Merge to preserve refresh_token if a later grant omits it.
  const existing = loadToken() || {};
  const merged = { ...existing, ...tokens };
  fs.writeFileSync(config.google.tokenPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(config.google.tokenPath, 0o600);
  } catch {
    /* best effort on non-POSIX */
  }
}

export function disconnect() {
  if (hasToken()) fs.rmSync(config.google.tokenPath);
}

export function isConfigured() {
  return config.google.configured();
}

export function isConnected() {
  return isConfigured() && hasToken();
}

export function getAuthUrl() {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // ensure we get a refresh_token
    scope: SCOPES,
  });
}

export async function handleCallback(code) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  saveToken(tokens);
  return true;
}

function authedClient() {
  const client = newOAuthClient();
  const tokens = loadToken();
  if (!tokens) throw new Error('Google not connected');
  client.setCredentials(tokens);
  // Persist refreshed tokens automatically.
  client.on('tokens', (t) => saveToken(t));
  return client;
}

export async function listCalendars() {
  const cal = google.calendar({ version: 'v3', auth: authedClient() });
  const { data } = await cal.calendarList.list();
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
    backgroundColor: c.backgroundColor,
    accessRole: c.accessRole,
  }));
}

// Pull events from selected calendars into the local events table (source=google).
export async function syncEvents({ daysBack = 7, daysAhead = 60 } = {}) {
  if (!isConnected()) return { synced: 0, skipped: true };
  const cal = google.calendar({ version: 'v3', auth: authedClient() });

  let selected = getSetting('google.selectedCalendars');
  if (!Array.isArray(selected) || selected.length === 0) {
    // Default to primary if none chosen.
    const cals = await listCalendars();
    const primary = cals.find((c) => c.primary);
    selected = primary ? [primary.id] : cals.map((c) => c.id);
  }

  const timeMin = new Date(Date.now() - daysBack * 864e5).toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 864e5).toISOString();

  const upsert = db.prepare(
    `INSERT INTO events (title, description, location, start, "end", all_day, source, google_id, google_cal_id, color, updated_at)
     VALUES (@title,@description,@location,@start,@end,@all_day,'google',@google_id,@google_cal_id,@color,datetime('now'))
     ON CONFLICT(google_cal_id, google_id) DO UPDATE SET
       title=excluded.title, description=excluded.description, location=excluded.location,
       start=excluded.start, "end"=excluded."end", all_day=excluded.all_day,
       updated_at=datetime('now')`
  );

  let synced = 0;
  const seenIds = [];
  for (const calId of selected) {
    let pageToken;
    do {
      const { data } = await cal.events.list({
        calendarId: calId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken,
      });
      for (const ev of data.items || []) {
        if (ev.status === 'cancelled') continue;
        const allDay = Boolean(ev.start?.date);
        const start = ev.start?.dateTime || ev.start?.date;
        const end = ev.end?.dateTime || ev.end?.date;
        if (!start || !end) continue;
        upsert.run({
          title: ev.summary || '(no title)',
          description: ev.description || null,
          location: ev.location || null,
          start,
          end,
          all_day: allDay ? 1 : 0,
          google_id: ev.id,
          google_cal_id: calId,
          color: null,
        });
        seenIds.push(ev.id);
        synced += 1;
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  // Remove google events in range that no longer exist upstream.
  const tx = db.transaction(() => {
    const stale = db
      .prepare(
        `SELECT id, google_id FROM events WHERE source='google' AND start >= ? AND start <= ?`
      )
      .all(timeMin, timeMax);
    const seen = new Set(seenIds);
    const del = db.prepare('DELETE FROM events WHERE id = ?');
    for (const row of stale) {
      if (!seen.has(row.google_id)) del.run(row.id);
    }
  });
  tx();

  return { synced, calendars: selected, lastSync: new Date().toISOString() };
}

export async function createRemoteEvent(calendarId, event) {
  const cal = google.calendar({ version: 'v3', auth: authedClient() });
  const { data } = await cal.events.insert({ calendarId, requestBody: event });
  return data;
}

export async function deleteRemoteEvent(calendarId, eventId) {
  const cal = google.calendar({ version: 'v3', auth: authedClient() });
  await cal.events.delete({ calendarId, eventId });
  return true;
}
