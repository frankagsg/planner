import { runMigrations } from './migrate.js';
import { seedDemoData } from './seedData.js';
import { setSetting } from '../lib/settings.js';

runMigrations({ quiet: true });
const manifest = seedDemoData();
setSetting('general.demoSeeded', true);
console.log('[seed] demo data inserted:');
for (const [k, v] of Object.entries(manifest)) {
  console.log(`  ${k}: ${Array.isArray(v) ? v.length : v}`);
}
process.exit(0);
