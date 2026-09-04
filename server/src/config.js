import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo root is two levels up from server/src
const repoRoot = path.resolve(__dirname, '..', '..');

// Load .env from repo root (single source of truth for the whole project).
dotenv.config({ path: path.join(repoRoot, '.env') });

function resolvePath(p, fallback) {
  const value = p || fallback;
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function bool(v, def = false) {
  if (v === undefined) return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

export const config = {
  repoRoot,
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  isProd: (process.env.NODE_ENV || 'production') === 'production',

  databasePath: resolvePath(process.env.DATABASE_PATH, './database/planner.db'),
  backupDir: resolvePath(process.env.BACKUP_DIR, './backups'),
  backupRetention: parseInt(process.env.BACKUP_RETENTION || '7', 10),
  backupIntervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10),

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  adminToken: process.env.ADMIN_TOKEN || '',

  weather: {
    provider: process.env.WEATHER_PROVIDER || 'openmeteo',
    apiKey: process.env.WEATHER_API_KEY || '',
    lat: parseFloat(process.env.WEATHER_LAT || '40.7128'),
    lon: parseFloat(process.env.WEATHER_LON || '-74.0060'),
    label: process.env.WEATHER_LABEL || 'New York, NY',
    units: process.env.WEATHER_UNITS || 'imperial',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/google/callback',
    tokenPath: resolvePath(process.env.GOOGLE_TOKEN_PATH, './config/google-token.json'),
    configured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  kioskUrl: process.env.KIOSK_URL || 'http://localhost:4000',
  clientDist: path.resolve(repoRoot, 'client', 'dist'),
};

export default config;
