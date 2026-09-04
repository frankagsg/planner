import { runMigrations } from '../db/migrate.js';
import { createBackup, listBackups } from '../services/backup.js';

runMigrations({ quiet: true });
const result = await createBackup({ label: 'manual' });
console.log('[backup] created', result.name, `(${result.size} bytes)`);
console.log('[backup] current backups:');
for (const b of listBackups()) console.log(`  ${b.name}  ${b.size}b  ${b.createdAt}`);
process.exit(0);
