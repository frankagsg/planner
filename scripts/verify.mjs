#!/usr/bin/env node
// End-to-end smoke test: starts the server, hits key endpoints, checks the
// built client exists, then exits non-zero on any failure.
// Usage: node scripts/verify.mjs   (run from repo root after building client)

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 4055;
const base = `http://localhost:${PORT}`;

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  \u2713 ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    fail++;
    console.error(`  \u2717 ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function get(pathname) {
  const res = await fetch(base + pathname);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

console.log('Wall Planner verification');
console.log('=========================');

// Client build present?
const dist = path.join(repoRoot, 'client', 'dist', 'index.html');
check('client build exists (client/dist/index.html)', fs.existsSync(dist));

// Start server on a test port with a temp DB so we don't disturb real data.
const server = spawn('node', ['src/index.js'], {
  cwd: path.join(repoRoot, 'server'),
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    DATABASE_PATH: './database/verify.db',
    BACKUP_INTERVAL_HOURS: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get('/api/health');
      if (r.status === 200) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

try {
  const healthy = await waitForHealth();
  check('server starts and health endpoint responds', healthy);
  if (!healthy) {
    console.error('\nServer log:\n' + serverLog);
    throw new Error('server did not become healthy');
  }

  const health = await get('/api/health');
  check('health returns status ok', health.json?.status === 'ok');

  // Seed some data through the API to prove writes work.
  await fetch(base + '/api/setup/demo/seed', { method: 'POST' });

  const tasks = await get('/api/tasks?filter=all');
  check('tasks endpoint returns array', Array.isArray(tasks.json), `${tasks.json?.length} tasks`);

  const events = await get('/api/events');
  check('events endpoint returns array', Array.isArray(events.json), `${events.json?.length} events`);

  const notes = await get('/api/notes');
  check('notes endpoint returns array', Array.isArray(notes.json), `${notes.json?.length} notes`);

  const school = await get('/api/school/summary');
  check('school summary returns counts', typeof school.json?.remaining === 'number');

  const settings = await get('/api/settings');
  check('settings endpoint returns object', settings.json && typeof settings.json === 'object');

  const dash = await get('/api/dashboard');
  check('dashboard aggregate returns data', dash.json && 'todayEvents' in dash.json);

  const gstatus = await get('/api/google/status');
  check('google status returns configured flag', typeof gstatus.json?.configured === 'boolean');

  const spa = await get('/');
  check('serves built SPA at /', spa.status === 200 && spa.text.includes('<div id="root">'));

  const fallback = await get('/calendar');
  check('SPA fallback works for client routes', fallback.status === 200);

  const notFound = await get('/api/does-not-exist');
  check('unknown API route returns 404', notFound.status === 404);

  // Clean up demo data + temp db.
  await fetch(base + '/api/setup/demo/clear', { method: 'POST' });
} catch (err) {
  fail++;
  console.error('  \u2717 exception:', err.message);
} finally {
  server.kill('SIGTERM');
  // Remove temp verify DB.
  for (const suffix of ['', '-wal', '-shm']) {
    const f = path.join(repoRoot, 'database', 'verify.db' + suffix);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

console.log('=========================');
console.log(`Passed: ${pass}  Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
