#!/usr/bin/env node

/**
 * Generate Postman collection from OpenAPI specification
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

// Load OpenAPI spec
const openapiPath = path.join(__dirname, '..', 'docs', 'control-plane', 'openapi.yaml');
const outputPath = path.join(__dirname, '..', 'docs', 'control-plane', 'nofx-control-plane.postman_collection.json');

if (!fs.existsSync(openapiPath)) {
  console.error('OpenAPI specification not found at:', openapiPath);
  process.exit(1);
}

const openapi = YAML.load(openapiPath);

// Convert OpenAPI to Postman Collection v2.1
const collection = {
  info: {
    name: openapi.info.title,
    description: openapi.info.description,
    version: openapi.info.version,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    {
      key: 'baseUrl',
      value: 'http://localhost:3000',
      type: 'string'
    },
    {
      key: 'runId',
      value: '',
      type: 'string',
      description: 'Current run ID for testing'
    },
    {
      key: 'gateId',
      value: '',
      type: 'string',
      description: 'Current gate ID for testing'
    },
    {
      key: 'projectId',
      value: 'default',
      type: 'string'
    }
  ],
  auth: {
    type: 'apikey',
    apikey: [
      {
        key: 'in',
        value: 'cookie',
        type: 'string'
      },
      {
        key: 'key',
        value: 'nofx_admin',
        type: 'string'
      },
      {
        key: 'value',
        value: '{{adminCookie}}',
        type: 'string'
      }
    ]
  },
  item: []
};

// Group endpoints by tags
const tagGroups = {};

// Process each path
Object.entries(openapi.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, operation]) => {
    if (typeof operation !== 'object' || !operation.operationId) return;

    const tag = operation.tags?.[0] || 'Other';
    if (!tagGroups[tag]) {
      tagGroups[tag] = {
        name: tag,
        description: `${tag} operations`,
        item: []
      };
    }

    // Build Postman request
    const request = {
      name: operation.summary || operation.operationId,
      description: operation.description,
      request: {
        method: method.toUpperCase(),
        url: {
          raw: `{{baseUrl}}${path.replace(/{(\w+)}/g, ':$1')}`,
          host: ['{{baseUrl}}'],
          path: path.split('/').filter(Boolean).map(segment =>
            segment.startsWith('{') ? `:${segment.slice(1, -1)}` : segment
          )
        },
        header: [
          {
            key: 'Content-Type',
            value: 'application/json',
            type: 'text'
          }
        ]
      },
      response: []
    };

    // Add query parameters if present
    if (operation.parameters) {
      const queryParams = operation.parameters.filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        request.request.url.query = queryParams.map(param => ({
          key: param.name,
          value: param.schema?.default || '',
          description: param.description,
          disabled: !param.required
        }));
      }

      // Add path variables
      const pathParams = operation.parameters.filter(p => p.in === 'path');
      if (pathParams.length > 0) {
        request.request.url.variable = pathParams.map(param => ({
          key: param.name,
          value: `{{${param.name}}}`,
          description: param.description
        }));
      }
    }

    // Add request body if present
    if (operation.requestBody?.content?.['application/json']) {
      const schema = operation.requestBody.content['application/json'].schema;
      const examples = operation.requestBody.content['application/json'].examples;

      // Use first example or generate from schema
      let body = {};
      if (examples) {
        const firstExample = Object.values(examples)[0];
        body = firstExample.value;
      } else if (schema) {
        body = generateExampleFromSchema(schema);
      }

      request.request.body = {
        mode: 'raw',
        raw: JSON.stringify(body, null, 2),
        options: {
          raw: {
            language: 'json'
          }
        }
      };
    }

    // Add authentication requirement
    if (operation.security?.length > 0) {
      request.request.auth = {
        type: 'inherit'
      };
    } else {
      request.request.auth = {
        type: 'noauth'
      };
    }

    // Add example responses
    if (operation.responses) {
      Object.entries(operation.responses).forEach(([statusCode, response]) => {
        if (response.content?.['application/json']?.schema) {
          const example = {
            name: `${statusCode} - ${response.description}`,
            originalRequest: request.request,
            status: response.description,
            code: parseInt(statusCode),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json'
              }
            ],
            body: JSON.stringify(generateExampleFromSchema(response.content['application/json'].schema), null, 2)
          };
          request.response.push(example);
        }
      });
    }

    tagGroups[tag].item.push(request);
  });
});

// Helper function to generate example from schema
function generateExampleFromSchema(schema, depth = 0) {
  if (depth > 5) return null; // Prevent infinite recursion

  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    if (openapi.components?.schemas?.[refPath]) {
      return generateExampleFromSchema(openapi.components.schemas[refPath], depth + 1);
    }
  }

  if (schema.oneOf) {
    return generateExampleFromSchema(schema.oneOf[0], depth + 1);
  }

  switch (schema.type) {
    case 'object':
      const obj = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, prop]) => {
          obj[key] = generateExampleFromSchema(prop, depth + 1);
        });
      }
      return obj;

    case 'array':
      if (schema.items) {
        return [generateExampleFromSchema(schema.items, depth + 1)];
      }
      return [];

    case 'string':
      if (schema.format === 'uuid') return 'uuid-example';
      if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (schema.enum) return schema.enum[0];
      if (schema.example) return schema.example;
      return 'string';

    case 'integer':
    case 'number':
      if (schema.example !== undefined) return schema.example;
      if (schema.default !== undefined) return schema.default;
      return schema.type === 'integer' ? 1 : 1.0;

    case 'boolean':
      return schema.default !== undefined ? schema.default : true;

    default:
      return null;
  }
}

// Add tag groups to collection
collection.item = Object.values(tagGroups);

// Add setup folder with common requests
collection.item.unshift({
  name: 'Setup',
  description: 'Initial setup and authentication',
  item: [
    {
      name: 'Login (Get Admin Cookie)',
      request: {
        method: 'POST',
        url: {
          raw: '{{baseUrl}}/login',
          host: ['{{baseUrl}}'],
          path: ['login']
        },
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            password: 'admin'
          }, null, 2)
        }
      },
      response: []
    },
    {
      name: 'Health Check',
      request: {
        method: 'GET',
        url: {
          raw: '{{baseUrl}}/health',
          host: ['{{baseUrl}}'],
          path: ['health']
        }
      },
      response: []
    }
  ]
});

// Add example workflows
collection.item.push({
  name: 'Example Workflows',
  description: 'Common workflow examples',
  item: [
    {
      name: 'Simple Code Generation',
      request: {
        method: 'POST',
        url: {
          raw: '{{baseUrl}}/runs',
          host: ['{{baseUrl}}'],
          path: ['runs']
        },
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            plan: {
              goal: 'Generate hello world',
              steps: [
                {
                  name: 'hello',
                  tool: 'codegen',
                  inputs: {
                    prompt: 'Write a hello world function'
                  }
                }
              ]
            }
          }, null, 2)
        }
      }
    },
    {
      name: 'Quality Checked Deployment',
      request: {
        method: 'POST',
        url: {
          raw: '{{baseUrl}}/runs',
          host: ['{{baseUrl}}'],
          path: ['runs']
        },
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            plan: {
              goal: 'Deploy with quality checks',
              steps: [
                {
                  name: 'typecheck',
                  tool: 'gate:typecheck'
                },
                {
                  name: 'test',
                  tool: 'gate:test'
                },
                {
                  name: 'deploy',
                  tool: 'deploy:production',
                  inputs: {
                    environment: 'production'
                  }
                }
              ]
            }
          }, null, 2)
        }
      }
    },
    {
      name: 'AI from Prompt',
      request: {
        method: 'POST',
        url: {
          raw: '{{baseUrl}}/runs',
          host: ['{{baseUrl}}'],
          path: ['runs']
        },
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            standard: {
              prompt: 'Write unit tests for the auth module',
              quality: true,
              openPr: false
            }
          }, null, 2)
        }
      }
    }
  ]
});

// Write collection to file
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

console.log(`✅ Postman collection generated: ${outputPath}`);
console.log(`📚 Import this file into Postman to start testing the API`);
console.log(`\nQuick start:`);
console.log(`1. Import the collection into Postman`);
console.log(`2. Run the "Login" request in the Setup folder`);
console.log(`3. Copy the cookie from the response`);
console.log(`4. Set it as the 'adminCookie' collection variable`);
console.log(`5. Start making API calls!`);