import db from '../db/index.js';

// JSON-encoded key/value settings store with sensible defaults.

export const DEFAULT_SETTINGS = {
  // General
  'general.householdName': 'Our Home',
  'general.firstRunComplete': false,
  'general.demoSeeded': false,
  // Display
  'display.theme': 'auto', // light | dark | auto
  'display.accent': 'blush', // blush | lavender | sage | sky | amber
  'display.clock24h': false,
  'display.showSeconds': false,
  'display.dateFormat': 'EEEE, MMMM d', // date-fns format
  'display.screensaverMinutes': 10, // 0 disables
  'display.screensaverType': 'clock', // clock | photos
  // Screen schedule (informational for the app; enforced by OS script)
  'display.screenWake': '07:00',
  'display.screenSleep': '23:30',
  'display.screenScheduleEnabled': true,
  // Navigation
  'nav.homeLabel': 'Home',
  // Weather (location can be overridden from env defaults)
  'weather.enabled': true,
  'weather.lat': null,
  'weather.lon': null,
  'weather.label': null,
  'weather.units': null, // null => use env default
  // Calendar
  'calendar.defaultView': 'timeGridWeek',
  'calendar.weekStartsOn': 0, // 0 Sunday
  'calendar.businessStart': '07:00',
  'calendar.businessEnd': '22:00',
  // Personal
  'personal.enabled': true,
  // Google
  'google.autoSyncMinutes': 15,
  'google.selectedCalendars': [], // array of calendar ids to display
};

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row) {
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }
  return DEFAULT_SETTINGS[key];
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      stored[r.key] = r.value;
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function setSetting(key, value) {
  const json = JSON.stringify(value);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, json);
  return value;
}

export function setSettings(obj) {
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) setSetting(k, v);
  });
  tx(Object.entries(obj));
  return getAllSettings();
}
