import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import config from '../config.js';
import db from '../db/index.js';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Create a .zip archive of the SQLite DB (checkpointed) + settings snapshot.
export async function createBackup({ label = 'manual' } = {}) {
  ensureDir(config.backupDir);
  // Flush WAL into the main DB file so the copy is consistent.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    /* ignore */
  }

  const name = `backup-${label}-${timestamp()}.zip`;
  const outPath = path.join(config.backupDir, name);
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);
  if (fs.existsSync(config.databasePath)) {
    archive.file(config.databasePath, { name: 'planner.db' });
  }
  // Include a metadata file.
  archive.append(
    JSON.stringify(
      { createdAt: new Date().toISOString(), label, version: 1 },
      null,
      2
    ),
    { name: 'backup-meta.json' }
  );
  await archive.finalize();
  await done;

  pruneOldBackups();
  const stat = fs.statSync(outPath);
  return { name, path: outPath, size: stat.size, createdAt: new Date().toISOString() };
}

export function listBackups() {
  ensureDir(config.backupDir);
  return fs
    .readdirSync(config.backupDir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => {
      const p = path.join(config.backupDir, f);
      const s = fs.statSync(p);
      return { name: f, size: s.size, createdAt: s.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pruneOldBackups() {
  const backups = listBackups();
  const keep = Math.max(1, config.backupRetention);
  const toDelete = backups.slice(keep);
  for (const b of toDelete) {
    try {
      fs.rmSync(path.join(config.backupDir, b.name));
    } catch {
      /* ignore */
    }
  }
  return toDelete.map((b) => b.name);
}

export function backupPath(name) {
  // Prevent path traversal — only allow a bare filename in the backup dir.
  const safe = path.basename(name);
  const p = path.join(config.backupDir, safe);
  if (!p.startsWith(path.resolve(config.backupDir))) throw new Error('Invalid path');
  if (!fs.existsSync(p)) throw new Error('Backup not found');
  return p;
}

// Restore from an uploaded/selected .zip: replaces the live DB.
export async function restoreBackup(zipPath) {
  const tmpDir = path.join(config.backupDir, `.restore-${timestamp()}`);
  ensureDir(tmpDir);
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: tmpDir }))
    .promise();

  const extractedDb = path.join(tmpDir, 'planner.db');
  if (!fs.existsSync(extractedDb)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Archive does not contain planner.db');
  }

  // Safety backup of current DB before overwriting.
  await createBackup({ label: 'pre-restore' });

  // Close WAL side files, then swap.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    /* ignore */
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const f = config.databasePath + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  fs.copyFileSync(extractedDb, config.databasePath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { restored: true, note: 'Restart the server to fully reload the database.' };
}

let timer = null;
export function startBackupScheduler() {
  if (config.backupIntervalHours <= 0) return;
  const ms = config.backupIntervalHours * 3600 * 1000;
  timer = setInterval(() => {
    createBackup({ label: 'auto' }).catch((e) =>
      console.error('[backup] auto backup failed', e.message)
    );
  }, ms);
  if (timer.unref) timer.unref();
  console.log(`[backup] scheduler every ${config.backupIntervalHours}h, keep ${config.backupRetention}`);
}
