import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'node:path';
import fs from 'node:fs';

export default function mount(app: Express) {
  // Load OpenAPI specification
  const openapiPath = path.join(process.cwd(), 'docs', 'control-plane', 'openapi.yaml');

  if (fs.existsSync(openapiPath)) {
    try {
      const swaggerDocument = YAML.load(openapiPath);

      // Serve Swagger UI at /api-docs
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'NOFX Control Plane API',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          displayOperationId: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true
        }
      }));

      // Serve raw OpenAPI spec
      app.get('/openapi.yaml', (_req, res) => {
        res.type('text/yaml');
        res.sendFile(openapiPath);
      });

      app.get('/openapi.json', (_req, res) => {
        res.json(swaggerDocument);
      });

      console.log('📚 API documentation available at /api-docs');
    } catch (error) {
      console.error('Failed to load OpenAPI specification:', error);
    }
  } else {
    console.warn('OpenAPI specification not found at:', openapiPath);
  }
}