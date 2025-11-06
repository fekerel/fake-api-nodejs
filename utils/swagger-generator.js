import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { entitySchemas } from '../schema/entities.mjs';
import { filterConfig } from '../schema/filter-config.mjs';
import { generateRecord, buildHelpers } from '../schema/generator.mjs';

export default async function generateSwaggerDocs() {
  const paths = {};
  const schemas = {};

  // Generate paths and schemas from entities
  Object.entries(entitySchemas).forEach(([collection, entitySpec]) => {
    schemas[collection] = entityToOpenApiSchema(entitySpec);
    const { requestExample, itemExample, listExample } = buildExamples(collection, entitySpec);

    // Generate CRUD endpoints
    paths[`/${collection}`] = {
      get: {
        summary: `Get all ${collection}`,
        parameters: generateQueryParamsFromSchema(collection, entitySpec),
        responses: {
          '200': {
            description: `List of ${collection}`,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${collection}` }
                },
                example: listExample
              }
            }
          }
        }
      },
      post: {
        summary: `Create new ${collection}`,
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${collection}` },
              example: requestExample
            }
          }
        },
        responses: {
          '201': {
            description: 'Created successfully',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${collection}` },
                example: itemExample
              }
            }
          }
        }
      }
    };

    paths[`/${collection}/{id}`] = {
      get: {
        summary: `Get ${collection} by id`,
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: `${collection} found`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: itemExample } } } }
      },
      put: {
        summary: `Update ${collection} by id`,
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: requestExample } } },
        responses: {
          '200': { description: `${collection} updated successfully`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: itemExample } } },
          '404': { description: 'Not found' }
        }
      },
      delete: {
        summary: `Delete ${collection} by id`,
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: `${collection} deleted successfully` },
          '404': { description: 'Not found' }
        }
      }
    };
  });

  // load route docs and merge (route docs take precedence)
  const routeDocs = await loadRouteDocs();
  const finalPaths = Object.assign({}, paths, routeDocs.paths || {});
  const finalSchemas = Object.assign({}, schemas, (routeDocs.components && routeDocs.components.schemas) || {});

  return {
    openapi: '3.0.0',
    info: { title: 'JSON Server API', version: '1.0.0' },
    paths: finalPaths,
    components: { schemas: finalSchemas }
  };
}

// Convert entities spec -> OpenAPI Schema
function entityToOpenApiSchema(entitySpec) {
  const properties = {};
  const required = [];

  for (const [name, spec] of Object.entries(entitySpec || {})) {
    const prop = fieldToSchema(spec);
    properties[name] = prop;
    if (!spec?.nullable) required.push(name);
    if (spec?.primary) prop.readOnly = true;
  }

  return {
    type: 'object',
    properties,
    required: required.length ? required : undefined
  };
}

function fieldToSchema(spec) {
  if (!spec) return {};
  if (spec.type === 'object') {
    const nestedProps = {};
    const req = [];
    for (const [k, fs] of Object.entries(spec.fields || {})) {
      nestedProps[k] = fieldToSchema(fs);
      if (!fs?.nullable) req.push(k);
    }
    return { type: 'object', properties: nestedProps, required: req.length ? req : undefined };
  }
  if (spec.type === 'array') {
    const items = fieldToSchema(spec.of);
    const out = { type: 'array', items };
    if (typeof spec.min === 'number') out.minItems = spec.min;
    if (typeof spec.max === 'number') out.maxItems = spec.max;
    return out;
  }
  // Expose enums as plain strings so clients can send values outside the listed set.
  // Keep a hint in description and an x-enum-values vendor extension for tooling.
  if (spec.type === 'enum') {
    const out = { type: 'string' };
    if (Array.isArray(spec.values) && spec.values.length) {
      out.description = `Accepted values (not restricted): ${spec.values.join(', ')}`;
      out['x-enum-values'] = spec.values;
    }
    return out;
  }
  if (spec.type === 'timestamp') return { type: 'integer', format: 'int64', description: 'Unix timestamp (ms)' };
  const base = { type: spec.type || 'string' };
  if (spec.relation) {
    base.description = `relation -> ${spec.relation.entity}.${spec.relation.field}`;
    base['x-relation'] = spec.relation;
  }
  if (spec.nullable) base.nullable = true;
  return base;
}

function mergeOpenApi(target, src) {
  if (!src) return;
  target.paths = target.paths || {};
  target.components = target.components || { schemas: {} };

  if (src.paths) {
    for (const [p, methods] of Object.entries(src.paths)) {
      target.paths[p] = target.paths[p] || {};
      for (const [m, spec] of Object.entries(methods)) {
        if (!target.paths[p][m]) target.paths[p][m] = spec;
      }
    }
  }

  if (src.components && src.components.schemas) {
    target.components.schemas = target.components.schemas || {};
    for (const [k, v] of Object.entries(src.components.schemas)) {
      if (!target.components.schemas[k]) target.components.schemas[k] = v;
    }
  }
}

async function loadRouteDocs() {
  const handlersDir = join(process.cwd(), 'routes');
  const docs = { paths: {}, components: { schemas: {} } };
  if (!existsSync(handlersDir)) return docs;

  const files = readdirSync(handlersDir);
  for (const f of files) {
    const full = join(handlersDir, f);
    try {
      if (f.endsWith('.js')) {
        const mod = await import(pathToFileURL(full).href);
        if (mod && mod.openapi) mergeOpenApi(docs, mod.openapi);
        if (mod && mod.default && mod.default.openapi) mergeOpenApi(docs, mod.default.openapi);
      } else if (f.endsWith('.openapi.json')) {
        const raw = readFileSync(full, 'utf8');
        mergeOpenApi(docs, JSON.parse(raw));
      }
    } catch (err) {
      console.error('swagger-generator: failed to load route doc', f, err.message);
    }
  }
  return docs;
}

// Query params from entity schema + filterConfig (fallback to reasonable defaults)
function flattenFields(spec, prefix = '') {
  const out = [];
  for (const [key, fs] of Object.entries(spec || {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (fs?.type === 'object' && fs.fields) out.push(...flattenFields(fs.fields, name));
    else out.push({ name, spec: fs });
  }
  return out;
}

function paramSchemaForField(spec) {
  if (!spec) return { type: 'string' };
  // For query params, expose enums as plain strings so any value can be filtered,
  // but keep an example and vendor extension for hints.
  if (spec.type === 'enum') {
    const out = { type: 'string' };
    if (Array.isArray(spec.values) && spec.values.length) {
      out['x-enum-values'] = spec.values;
    }
    return out;
  }
  if (spec.type === 'timestamp') return { type: 'integer', format: 'int64' };
  if (spec.type === 'integer') return { type: 'integer' };
  if (spec.type === 'number') return { type: 'number' };
  if (spec.type === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

function defaultOpsForField(spec) {
  switch (spec?.type) {
    case 'string': return ['eq', 'like'];
    case 'enum': return ['eq'];
    case 'integer':
    case 'number':
    case 'timestamp': return ['eq', 'gte', 'lte'];
    case 'boolean': return ['eq'];
    default: return [];
  }
}

function resolveOpsForField(entityName, fieldPath, spec) {
  const cfg = filterConfig?.[entityName]?.[fieldPath];
  if (Array.isArray(cfg) && cfg.length) return cfg;
  return defaultOpsForField(spec);
}

function generateQueryParamsFromSchema(entityName, entitySpec) {
  const params = [
    { in: 'query', name: 'q', schema: { type: 'string' }, description: 'Full-text search' },
    { in: 'query', name: '_sort', schema: { type: 'string' }, description: 'Sort by field' },
    { in: 'query', name: '_order', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Sort order' },
    { in: 'query', name: '_page', schema: { type: 'integer' }, description: 'Page number' },
    { in: 'query', name: '_limit', schema: { type: 'integer' }, description: 'Items per page' }
  ];

  const flat = flattenFields(entitySpec);
  for (const { name, spec } of flat) {
    if (!spec || spec.type === 'object' || spec.type === 'array') continue;
    const ops = resolveOpsForField(entityName, name, spec);
    if (!ops.length) continue;

    const baseSchema = paramSchemaForField(spec);
    for (const op of ops) {
      if (op === 'eq') {
        const suffix = spec.type === 'enum' && Array.isArray(spec.values) && spec.values.length
          ? ` (e.g. ${spec.values.join(' | ')})`
          : '';
        params.push({ in: 'query', name, schema: baseSchema, description: `Filter ${name} by equality${suffix}` });
      } else if (op === 'like' && spec.type === 'string') {
        const suffix = spec.type === 'enum' && Array.isArray(spec.values) && spec.values.length
          ? ` (e.g. ${spec.values.join(' | ')})`
          : '';
        params.push({ in: 'query', name: `${name}_like`, schema: { type: 'string' }, description: `Substring/regex match on ${name}${suffix}` });
      } else if (op === 'gte' && (spec.type === 'integer' || spec.type === 'number' || spec.type === 'timestamp')) {
        params.push({ in: 'query', name: `${name}_gte`, schema: baseSchema, description: `Minimum ${name}` });
      } else if (op === 'lte' && (spec.type === 'integer' || spec.type === 'number' || spec.type === 'timestamp')) {
        params.push({ in: 'query', name: `${name}_lte`, schema: baseSchema, description: `Maximum ${name}` });
      }
    }
  }

  return params;
}

// --- Examples via generator only ------------------------------------------
function stripPrimaryFields(entitySpec, obj) {
  const primaries = new Set(Object.entries(entitySpec || {})
    .filter(([, s]) => s && s.primary)
    .map(([k]) => k));
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (primaries.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function buildExamples(collection, entitySpec) {
  // generator-only: do not read database.json; just synthesize objects
  const db = {};
  const helpers = buildHelpers(db);
  const generated = generateRecord(collection, db, helpers) || {};
  const requestExample = stripPrimaryFields(entitySpec, generated);
  const itemExample = { id: 1, ...requestExample };
  const listExample = [itemExample];
  return { requestExample, itemExample, listExample };
}