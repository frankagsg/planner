-- Migration 003: personal section, countdowns, settings key-value store

CREATE TABLE IF NOT EXISTS countdowns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  target      TEXT NOT NULL,               -- ISO 8601 date/datetime
  color       TEXT NOT NULL DEFAULT '#e8a0bf',
  icon        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Personal "Frank + Jessie" section. Single row (id=1) config plus events.
CREATE TABLE IF NOT EXISTS personal_config (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  enabled        INTEGER NOT NULL DEFAULT 1,
  partner_a      TEXT NOT NULL DEFAULT 'Frank',
  partner_b      TEXT NOT NULL DEFAULT 'Jessie',
  message        TEXT DEFAULT 'Love you 💛',
  next_date_at   TEXT,                      -- ISO 8601 of the next date night
  next_date_note TEXT,
  photo_interval INTEGER NOT NULL DEFAULT 8, -- seconds per photo in rotator
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personal_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  at          TEXT NOT NULL,               -- ISO 8601
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Generic settings key/value. Values are JSON-encoded strings.
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schema version bookkeeping is handled by the migrate runner (_migrations).
