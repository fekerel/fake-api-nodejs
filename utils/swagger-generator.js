import { readFileSync } from 'fs';
import { join } from 'path';

function generateSwaggerDocs() {
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
            '201': {
              description: 'Created successfully'
            }
          }
        }
      };

      // Individual item endpoints
      paths[`/${collection}/{id}`] = {
        get: {
          summary: `Get ${collection} by id`,
          parameters: [{
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer' }
          }],
          responses: {
            '200': {
              description: `${collection} found`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${collection}` }
                }
              }
            }
          }
        },
        put: {
          summary: `Update ${collection} by id`,
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${collection}` }
              }
            }
          },
          responses: {
            '200': {
              description: `${collection} updated successfully`
            }
          }
        },
        delete: {
          summary: `Delete ${collection} by id`,
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            '200': {
              description: `${collection} deleted successfully`
            }
          }
        }
      };
    }
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'JSON Server API',
      version: '1.0.0'
    },
    paths,
    components: { schemas }
  };
}

function generateProperties(obj) {
  const properties = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      properties[key] = {
        type: 'object',
        properties: generateProperties(value)
      };
    } else {
      properties[key] = {
        type: typeof value,
        example: value
      };
    }
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

export default generateSwaggerDocs;