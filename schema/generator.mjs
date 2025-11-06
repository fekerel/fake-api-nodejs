import { entitySchemas } from './entities.mjs';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickRandom(arr) {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}
function resolveRelation(rel, db, where) {
  let target = db[rel.entity] || [];
  if (where && typeof where === 'object') {
    const keys = Object.keys(where);
    target = target.filter(r => keys.every(k => r[k] === where[k]));
  }
  const hit = pickRandom(target);
  return hit?.[rel.field] ?? null;
}

export function nextId(list) {
  const max = (list || []).reduce((m, x) => Math.max(m, Number(x?.id || 0)), 0);
  return max + 1;
}

export function buildHelpers(db) {
  return {
    pickVariantId() {
      const products = db.products || [];
      const p = products.length ? pickRandom(products) : null;
      const v = p?.variants?.length ? pickRandom(p.variants) : null;
      return v?.id ?? null;
    },
    peekProductPrice() {
      const products = db.products || [];
      const p = products.length ? pickRandom(products) : null;
      return p?.price ?? 0;
    }
  };
}

export function generateRecord(entityName, db, helpers = {}) {
  const schema = entitySchemas[entityName];
  if (!schema) throw new Error(`Unknown entity: ${entityName}`);

  const current = {};
  const ctx = { db, ...helpers };

  function genField(spec) {
    if (!spec) return null;
    if (spec.generator) return spec.generator(ctx, current);
    if (spec.relation) return resolveRelation(spec.relation, db, spec.relation.where);

    switch (spec.type) {
      case 'enum': return pickRandom(spec.values ?? []);
      case 'timestamp': return Date.now();
      case 'object': {
        const o = {};
        for (const [k, fs] of Object.entries(spec.fields || {})) o[k] = genField(fs);
        return o;
      }
      case 'array': {
        const min = spec.min ?? 0;
        const max = spec.max ?? min;
        const len = max >= min ? randInt(min, max) : min;
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(genField(spec.of));
        return arr;
      }
      case 'integer': return 0;
      case 'number': return 0;
      case 'string': return '';
      case 'boolean': return false;
      default: return null;
    }
  }

  for (const [key, spec] of Object.entries(schema)) {
    if (spec.primary) continue; // id dışarıdan atanacak
    current[key] = genField(spec);
  }
  return current;
}