import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'node:path';
import fs from 'node:fs';
import { log } from '../../lib/observability';

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
      app.get('/openapi.yaml', (_req, res): Promise<void> => {
        res.type('text/yaml');
        return res.sendFile(openapiPath);
      });

      app.get('/openapi.json', (_req, res): Promise<void> => {
        return res.json(swaggerDocument);
      });

      log.info({ path: '/api-docs' }, '📚 API documentation available');
    } catch (error) {
      log.error({ error, path: openapiPath }, 'Failed to load OpenAPI specification');
    }
  } else {
    log.warn({ path: openapiPath }, 'OpenAPI specification not found');
  }
}
