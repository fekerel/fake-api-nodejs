import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { entitySchemas } from '../schema/entities.mjs';
import { filterConfig } from '../schema/filter-config.mjs';
import { generateRecord, buildHelpers } from '../schema/generator.mjs';
import { CONFIG } from '../config.js';

export default async function generateSwaggerDocs() {
  const paths = {};
  const schemas = {};

  // Generate paths and schemas from entities
  Object.entries(entitySchemas).forEach(([collection, entitySpec]) => {
    schemas[collection] = entityToOpenApiSchema(entitySpec);
    const { requestExample, itemExample, listExample } = buildExamples(collection, entitySpec);
    // Generate CRUD endpoints
    paths[`/${collection}`] = {
      ...(collection === "products" && { isSelect: true }),
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
        ...(collection === "products" && { isSelect: true }),
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
        ...(collection === "products" && { isSelect: true }),
        summary: `Get ${collection} by id`,
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: `${collection} found`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: itemExample } } } }
      },
      put: {
        ...(collection === "products" && { isSelect: true }),
        summary: `Update ${collection} by id`,
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: requestExample } } },
        responses: {
          '200': { description: `${collection} updated successfully`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${collection}` }, example: itemExample } } },
          '404': { description: 'Not found' }
        }
      },
      delete: {
        ...((collection === "products" || collection === "reviews") && { isSelect: true }),
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

// Filter swagger docs to only include endpoints with isSelect: true
export function filterIsSelectOnly(swaggerSpec) {
  const filteredPaths = {};
  const usedSchemas = new Set();
  
  // First pass: filter paths and collect used schema references
  for (const [path, pathSpec] of Object.entries(swaggerSpec.paths || {})) {
    const filteredMethods = {};
    
    // Check each HTTP method (get, post, put, delete, etc.)
    for (const [method, methodSpec] of Object.entries(pathSpec)) {
      // Skip non-method properties like isSelect at path level
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) {
        // Only include methods that have isSelect: true (strict boolean check)
        if (methodSpec && methodSpec.isSelect === true) {
          filteredMethods[method] = methodSpec;
          
          // Collect schema references from this method
          collectSchemaRefs(methodSpec, usedSchemas);
        }
      }
    }
    
    // Only add path if it has at least one method with isSelect: true
    if (Object.keys(filteredMethods).length > 0) {
      filteredPaths[path] = filteredMethods;
    }
  }
  
  // Recursively collect all nested schema references
  if (swaggerSpec.components && swaggerSpec.components.schemas) {
    let previousSize = 0;
    while (usedSchemas.size > previousSize) {
      previousSize = usedSchemas.size;
      for (const schemaName of [...usedSchemas]) {
        if (swaggerSpec.components.schemas[schemaName]) {
          collectSchemaRefs(swaggerSpec.components.schemas[schemaName], usedSchemas);
        }
      }
    }
  }
  
  // Filter schemas to only include used ones (now includes nested refs)
  const filteredSchemas = {};
  if (swaggerSpec.components && swaggerSpec.components.schemas) {
    for (const [schemaName, schema] of Object.entries(swaggerSpec.components.schemas)) {
      if (usedSchemas.has(schemaName)) {
        filteredSchemas[schemaName] = schema;
      }
    }
  }
  
  return {
    ...swaggerSpec,
    paths: filteredPaths,
    components: {
      ...swaggerSpec.components,
      schemas: filteredSchemas
    },
    info: {
      ...swaggerSpec.info,
      title: swaggerSpec.info.title + ' (isSelect Only)',
      description: 'Only endpoints with isSelect: true are shown'
    }
  };
}

// Transform swagger spec based on active breaking changes
export function applyBreakingChanges(swaggerSpec) {
  if (!CONFIG.breakingChanges.enabled) return swaggerSpec;
  
  const activeBreakings = CONFIG.breakingChanges.activeBreakings;
  if (!activeBreakings || Object.keys(activeBreakings).length === 0) return swaggerSpec;
  
  // Deep clone to avoid mutating original
  const spec = JSON.parse(JSON.stringify(swaggerSpec));
  
  // Load breakingMeta from route files to get field mappings
  const breakingDefinitions = getBreakingDefinitions();
  
  for (const [endpointKey, breakingTypes] of Object.entries(activeBreakings)) {
    const [method, path] = endpointKey.split(' ');
    const methodLower = method.toLowerCase();
    
    if (!spec.paths[path] || !spec.paths[path][methodLower]) continue;
    
    const methodSpec = spec.paths[path][methodLower];
    const definitions = breakingDefinitions[endpointKey];
    
    // breakingTypes is now an array, e.g., ['FIELD_RENAME', 'STATUS_CODE']
    const types = Array.isArray(breakingTypes) ? breakingTypes : [breakingTypes];
    
    // Add breaking change metadata to spec (now shows all active types)
    methodSpec['x-breaking-changes'] = types.map(type => ({
      type: type,
      description: getBreakingDescription(type)
    }));
    
    // Apply each breaking change type
    for (const breakingType of types) {
      switch (breakingType) {
        case 'FIELD_RENAME':
          applyFieldRenameToSpec(methodSpec, spec.components?.schemas, definitions);
          break;
        case 'STATUS_CODE':
          applyStatusCodeToSpec(methodSpec, definitions);
          break;
        case 'REQUIRED_FIELD':
          applyRequiredFieldToSpec(methodSpec, definitions);
          break;
        case 'RESPONSE_STRUCTURE':
          applyResponseStructureToSpec(methodSpec, definitions);
          break;
      }
    }
  }
  
  // Re-collect all schema refs after breaking changes applied
  // This ensures schemas used in new response codes are included
  const usedSchemas = new Set();
  for (const pathSpec of Object.values(spec.paths || {})) {
    for (const methodSpec of Object.values(pathSpec)) {
      if (typeof methodSpec === 'object') {
        collectSchemaRefs(methodSpec, usedSchemas);
      }
    }
  }
  
  // Ensure all used schemas are in components
  // Also recursively collect nested schema references
  if (swaggerSpec.components?.schemas) {
    // Keep adding schemas until no new ones are found
    let previousSize = 0;
    while (usedSchemas.size > previousSize) {
      previousSize = usedSchemas.size;
      for (const schemaName of [...usedSchemas]) {
        // Copy schema if missing
        if (!spec.components.schemas[schemaName] && swaggerSpec.components.schemas[schemaName]) {
          spec.components.schemas[schemaName] = JSON.parse(JSON.stringify(swaggerSpec.components.schemas[schemaName]));
        }
        // Collect nested refs from this schema
        if (swaggerSpec.components.schemas[schemaName]) {
          collectSchemaRefs(swaggerSpec.components.schemas[schemaName], usedSchemas);
        }
      }
    }
  }
  
  return spec;
}

function getBreakingDescription(type) {
  const descriptions = {
    'FIELD_RENAME': 'Field names have been changed (e.g., productId → product_id)',
    'STATUS_CODE': 'Success status code has been changed (e.g., 200 → 201)',
    'REQUIRED_FIELD': 'New required field has been added',
    'RESPONSE_STRUCTURE': 'Response is wrapped in a different structure',
    'ENUM_VALUE_CHANGE': 'Enum values have been changed',
    'TYPE_CHANGE': 'Field types have been changed'
  };
  return descriptions[type] || 'Breaking change applied';
}

// Get breaking definitions from route files (cached)
let _breakingDefinitionsCache = null;
async function loadBreakingDefinitionsFromRoutes() {
  const handlersDir = join(process.cwd(), 'routes');
  const definitions = {};
  
  if (!existsSync(handlersDir)) return definitions;
  
  const files = readdirSync(handlersDir);
  for (const f of files) {
    if (!f.endsWith('.js')) continue;
    
    const full = join(handlersDir, f);
    try {
      const mod = await import(pathToFileURL(full).href);
      const meta = mod.breakingMeta;
      
      if (meta && meta.method && meta.path && meta.definitions) {
        const endpointKey = `${meta.method} ${meta.path}`;
        definitions[endpointKey] = meta.definitions;
      }
    } catch (err) {
      // Ignore errors - file might not have breakingMeta
    }
  }
  
  return definitions;
}

function getBreakingDefinitions() {
  // Return cached if available (sync access after initial load)
  return _breakingDefinitionsCache || {};
}

// Initialize breaking definitions cache (call this at startup)
export async function initBreakingDefinitions() {
  _breakingDefinitionsCache = await loadBreakingDefinitionsFromRoutes();
  return _breakingDefinitionsCache;
}

// Apply FIELD_RENAME to spec (REQUEST ONLY - not response)
function applyFieldRenameToSpec(methodSpec, schemas, definitions) {
  if (!definitions?.FIELD_RENAME?.fieldMappings) return;
  
  const mappings = definitions.FIELD_RENAME.fieldMappings;
  
  // Transform query/path parameters
  if (methodSpec.parameters && Array.isArray(methodSpec.parameters)) {
    methodSpec.parameters = methodSpec.parameters.map(param => {
      if (mappings[param.name]) {
        return { ...param, name: mappings[param.name] };
      }
      return param;
    });
  }
  
  // Transform request body schema
  if (methodSpec.requestBody?.content?.['application/json']?.schema) {
    transformSchemaFields(methodSpec.requestBody.content['application/json'].schema, mappings, schemas);
  }
  
  // Transform request body examples
  if (methodSpec.requestBody?.content?.['application/json']?.examples) {
    for (const example of Object.values(methodSpec.requestBody.content['application/json'].examples)) {
      if (example.value) {
        example.value = transformObjectFields(example.value, mappings);
      }
    }
  }
  
  // NOTE: Response is NOT transformed - only request fields are renamed
}

function transformSchemaFields(schema, mappings, allSchemas) {
  if (!schema) return;
  
  // Handle $ref - need to transform the referenced schema
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    if (allSchemas && allSchemas[refName]) {
      transformSchemaFields(allSchemas[refName], mappings, allSchemas);
    }
    return;
  }
  
  // Transform properties
  if (schema.properties) {
    const newProps = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      const newKey = mappings[key] || key;
      newProps[newKey] = value;
      // Recursively transform nested objects
      transformSchemaFields(value, mappings, allSchemas);
    }
    schema.properties = newProps;
  }
  
  // Transform required array
  if (schema.required && Array.isArray(schema.required)) {
    schema.required = schema.required.map(field => mappings[field] || field);
  }
  
  // Transform array items
  if (schema.items) {
    transformSchemaFields(schema.items, mappings, allSchemas);
  }
}

function transformObjectFields(obj, mappings) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectFields(item, mappings));
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = mappings[key] || key;
    result[newKey] = transformObjectFields(value, mappings);
  }
  return result;
}

// Apply STATUS_CODE to spec
function applyStatusCodeToSpec(methodSpec, definitions) {
  const newCode = definitions?.STATUS_CODE?.successCode || '201';
  const responses = methodSpec.responses;
  
  if (responses && responses['200']) {
    // Move 200 response to new code
    responses[newCode] = {
      ...responses['200'],
      description: responses['200'].description
    };
    delete responses['200'];
  }
}

// Apply REQUIRED_FIELD to spec
function applyRequiredFieldToSpec(methodSpec, definitions) {
  if (!definitions?.REQUIRED_FIELD) return;
  
  const { field, type = 'string' } = definitions.REQUIRED_FIELD;
  if (!field) return;
  
  // Add to request body schema
  if (methodSpec.requestBody?.content?.['application/json']?.schema?.properties) {
    const schema = methodSpec.requestBody.content['application/json'].schema;
    
    // Handle nested field (e.g., updates[].reason)
    const parts = field.split('[].');
    if (parts.length === 2) {
      // Array item field
      const [arrayProp, itemField] = parts;
      if (schema.properties[arrayProp]?.items?.properties) {
        schema.properties[arrayProp].items.properties[itemField] = { type };
        if (!schema.properties[arrayProp].items.required) {
          schema.properties[arrayProp].items.required = [];
        }
        schema.properties[arrayProp].items.required.push(itemField);
      }
    } else {
      // Top-level field
      schema.properties[field] = { type };
      if (!schema.required) schema.required = [];
      schema.required.push(field);
    }
  }
}

// Apply RESPONSE_STRUCTURE to spec
function applyResponseStructureToSpec(methodSpec, definitions) {
  const wrapKey = definitions?.RESPONSE_STRUCTURE?.wrapKey || 'data';
  
  for (const [code, response] of Object.entries(methodSpec.responses || {})) {
    if (response.content?.['application/json']?.schema) {
      const originalSchema = response.content['application/json'].schema;
      response.content['application/json'].schema = {
        type: 'object',
        properties: {
          [wrapKey]: originalSchema
        }
      };
    }
  }
}

// Helper function to collect schema references from a method spec
function collectSchemaRefs(obj, usedSchemas) {
  if (!obj || typeof obj !== 'object') return;
  
  if (Array.isArray(obj)) {
    obj.forEach(item => collectSchemaRefs(item, usedSchemas));
    return;
  }
  
  // Check for $ref
  if (obj.$ref && typeof obj.$ref === 'string') {
    const match = obj.$ref.match(/#\/components\/schemas\/(.+)/);
    if (match) {
      usedSchemas.add(match[1]);
    }
  }
  
  // Check for items with $ref (arrays)
  if (obj.items && obj.items.$ref) {
    const match = obj.items.$ref.match(/#\/components\/schemas\/(.+)/);
    if (match) {
      usedSchemas.add(match[1]);
    }
  }
  
  // Recursively check all properties
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      collectSchemaRefs(value, usedSchemas);
    }
  }
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
// Strip fields that clients should not send on create/update: primary keys + server managed timestamps.
function stripPrimaryFields(entitySpec, obj) {
  const primaries = new Set(
    Object.entries(entitySpec || {})
      .filter(([, s]) => s && s.primary)
      .map(([k]) => k)
  );
  const serverManaged = new Set(['createdAt', 'modifiedAt']);
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (primaries.has(k) || serverManaged.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function buildExamples(collection, entitySpec) {
  // generator-only: do not read database.json; just synthesize objects
  const db = {};
  const helpers = buildHelpers(db);
  const generated = generateRecord(collection, db, helpers) || {};
  const requestExample = stripPrimaryFields(entitySpec, generated); // exclude id, createdAt, modifiedAt from request body example
  // Response item example should include server managed fields
  const itemExample = { ...generated, id: 1 };
  const listExample = [itemExample];
  return { requestExample, itemExample, listExample };
}