import config from './config.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { startBackupScheduler } from './services/backup.js';
import { isConnected, syncEvents } from './services/google.js';
import { getSetting } from './lib/settings.js';

// 1) Ensure schema is current before serving.
runMigrations();

// 2) Build and start the server.
const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`[server] Wall Planner API listening on http://${config.host}:${config.port}`);
  console.log(`[server] env=${config.nodeEnv} db=${config.databasePath}`);
});

// 3) Background schedulers.
startBackupScheduler();

// Periodic Google sync (best-effort, non-fatal).
if (isConnected()) {
  const minutes = Number(getSetting('google.autoSyncMinutes')) || 15;
  const ms = Math.max(5, minutes) * 60 * 1000;
  const t = setInterval(() => {
    syncEvents().catch((e) => console.error('[google] periodic sync failed', e.message));
  }, ms);
  if (t.unref) t.unref();
  // Kick one sync shortly after boot.
  setTimeout(() => syncEvents().catch(() => {}), 3000);
}

// 4) Graceful shutdown.
function shutdown(sig) {
  console.log(`[server] ${sig} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Never let an unhandled rejection crash the kiosk silently.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException', err);
});

export default server;
