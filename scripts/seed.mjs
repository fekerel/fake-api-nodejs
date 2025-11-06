import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { entitySchemas } from '../schema/entities.mjs';
import { generateRecord, nextId, buildHelpers } from '../schema/generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'database.json');

const readDb = () => (fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {});
function writeDb(db) {
  const data = JSON.stringify(db, null, 2);
  // Retry on Windows EPERM (file busy) if server is running and holding a handle
  const maxAttempts = 5;
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      fs.writeFileSync(dbPath, data);
      return;
    } catch (e) {
      lastErr = e;
      if (e && e.code === 'EPERM') {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
        continue;
      }
      throw e;
    }
  }
  if (lastErr) throw lastErr;
}

function ensureCollections(db) {
  for (const key of Object.keys(entitySchemas)) if (!db[key]) db[key] = [];
  return db;
}

function parseArgs() {
  // ör: node scripts/seed.mjs products=10 reviews=20 mode=regenerate
  return Object.fromEntries(process.argv.slice(2).map(s => {
    const [k, v] = s.split('=');
    return [k, v ?? true];
  }));
}

function main() {
  const args = parseArgs();
  let db = readDb();
  ensureCollections(db);

  const mode = args.mode || 'append'; // append | regenerate
  const plan = Object.entries(args)
    .filter(([k]) => k !== 'mode')
    .map(([entity, val]) => ({ entity, count: Number(val) }))
    .filter(x => !Number.isNaN(x.count) && entitySchemas[x.entity]);

  if (mode === 'regenerate') for (const { entity } of plan) db[entity] = [];

  const helpers = buildHelpers(db);

  for (const { entity, count } of plan) {
    const list = db[entity];
    for (let i = 0; i < count; i++) {
      const rec = generateRecord(entity, db, helpers);
      list.push({ id: nextId(list), ...rec });
    }
    console.log(`Generated ${count} ${entity}`);
  }

  writeDb(db);
  console.log('database.json updated');
}

main();