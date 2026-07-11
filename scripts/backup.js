// Make an on-demand backup of the database. Run `npm run backup` any time
// (e.g. a nightly cron). Backups land next to the database as backup-*.db.
import { db } from '../src/db.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.KAIRO_DATA_DIR || path.join(ROOT, 'data');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = path.join(DATA_DIR, `backup-manual-${stamp}.db`);

db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
console.log(`Backup written to ${dest}`);
