import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';

export default async function generateSwaggerDocs() {
  // Read database.json
  const db = JSON.parse(readFileSync(join(process.cwd(), 'database.json'), 'utf8'));
  
  const paths = {};
  const schemas = {};

  // Generate paths and schemas for each collection
  Object.entries(db).forEach(([collection, data]) => {
    if (Array.isArray(data) && data.length > 0) {
      // Generate schema from first item
      schemas[collection] = {
        type: 'object',
        properties: generateProperties(data[0])
      };

      // Generate CRUD endpoints
      paths[`/${collection}`] = {
        get: {
          summary: `Get all ${collection}`,
          parameters: generateQueryParams(data[0]),
          responses: {
            '200': {
              description: `List of ${collection}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: `#/components/schemas/${collection}` }
                  }
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
                schema: { $ref: `#/components/schemas/${collection}` }
              }
            }
          },
          responses: {
            '201': { description: 'Created successfully' }
          }
        }
      };

      paths[`/${collection}/{id}`] = {
        get: {
          summary: `Get ${collection} by id`,
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: `${collection} found`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` } } } } }
        },
        put: {
          summary: `Update ${collection} by id`,
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` } } } },
          responses: { '200': { description: `${collection} updated successfully` } }
        },
        delete: {
          summary: `Delete ${collection} by id`,
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: `${collection} deleted successfully` } }
        }
      };
    }
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
        // support named export `export const openapi = {...}`
        if (mod && mod.openapi) mergeOpenApi(docs, mod.openapi);
        // support default export with openapi property: export default (app)=>{}; export default.openapi = {...}
        if (mod && mod.default && mod.default.openapi) mergeOpenApi(docs, mod.default.openapi);
      } else if (f.endsWith('.openapi.json')) {
        const raw = readFileSync(full, 'utf8');
        const parsed = JSON.parse(raw);
        mergeOpenApi(docs, parsed);
      }
    } catch (err) {
      console.error('swagger-generator: failed to load route doc', f, err.message);
    }
  }
  return docs;
}

function detectType(value) {
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'string') {
    // ISO date-time
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value))) return { type: 'string', format: 'date-time' };
    // simple date
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { type: 'string', format: 'date' };
    // email
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(value)) return { type: 'string', format: 'email' };
    return { type: 'string' };
  }
  return { type: 'string' };
}

function generateProperties(obj) {
  const properties = {};

  Object.entries(obj || {}).forEach(([key, value]) => {
    // null -> nullable
    if (value === null) {
      properties[key] = { nullable: true, example: null };
      return;
    }

    // arrays
    if (Array.isArray(value)) {
      let itemsSchema = { type: 'string' };
      if (value.length > 0) {
        const first = value.find(v => v !== null && v !== undefined);
        if (first !== undefined) {
          if (Array.isArray(first)) {
            itemsSchema = { type: 'array', items: { type: typeof (first[0]) || 'string' } };
          } else if (typeof first === 'object' && first !== null) {
            itemsSchema = { type: 'object', properties: generateProperties(first) };
          } else {
            const d = detectType(first);
            itemsSchema = Object.assign({}, d);
          }
        }
      }
      properties[key] = { type: 'array', items: itemsSchema, example: value };
      return;
    }

    // nested object
    if (typeof value === 'object' && value !== null) {
      properties[key] = { type: 'object', properties: generateProperties(value), example: value };
      return;
    }

    // primitive
    const det = detectType(value);
    const schema = { type: det.type };
    if (det.format) schema.format = det.format;
    schema.example = value;
    properties[key] = schema;
  });

  return properties;
}

function generateQueryParams(obj) {
  const params = [
    {
      in: 'query',
      name: '_sort',
      schema: { type: 'string' },
      description: 'Sort by field'
    },
    {
      in: 'query',
      name: '_order',
      schema: { type: 'string', enum: ['asc', 'desc'] },
      description: 'Sort order'
    },
    {
      in: 'query',
      name: '_page',
      schema: { type: 'integer' },
      description: 'Page number'
    },
    {
      in: 'query',
      name: '_limit',
      schema: { type: 'integer' },
      description: 'Items per page'
    }
  ];

  // Add field-specific filters
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'number') {
      params.push(
        {
          in: 'query',
          name: `${key}_gte`,
          schema: { type: 'number' },
          description: `Minimum ${key}`
        },
        {
          in: 'query',
          name: `${key}_lte`,
          schema: { type: 'number' },
          description: `Maximum ${key}`
        }
      );
    }
  });

  return params;
}