import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';

// Ensure the database directory exists.
const dir = path.dirname(config.databasePath);
fs.mkdirSync(dir, { recursive: true });

const db = new Database(config.databasePath);

// Pragmas tuned for a single-node kiosk: WAL for concurrent reads while
// writing, NORMAL sync for a good durability/perf balance, foreign keys on.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export default db;
