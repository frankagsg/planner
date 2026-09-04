import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './index.js';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(config.repoRoot, 'database', 'migrations');

export function runMigrations({ quiet = false } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(file);
    });
    tx();
    count += 1;
    if (!quiet) console.log(`[migrate] applied ${file}`);
  }

  // Ensure singleton personal_config row exists.
  db.prepare(
    `INSERT OR IGNORE INTO personal_config (id) VALUES (1)`
  ).run();

  if (!quiet) {
    if (count === 0) console.log('[migrate] up to date');
    else console.log(`[migrate] applied ${count} migration(s)`);
  }
  return count;
}

// Run directly: `node src/db/migrate.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  process.exit(0);
}
