/**
 * NOFX API Server - Refactored using Compose Methods pattern
 * Now organized into focused, single-purpose modules
 */

import express from "express";
import dotenv from "dotenv";
import http from 'node:http';
import { requireAuth, checkUsage, trackApiUsage } from '../auth/middleware';
import { initAutoBackupFromSettings } from '../lib/autobackup';
import startOutboxRelay from '../worker/relay';
import { initTracing } from '../lib/tracing';
import { shouldEnableDevRestartWatch } from '../lib/devRestart';
import { performanceMiddleware, performanceMonitor } from '../lib/performance-monitor';
import { idempotency, initializeIdempotencyCache } from '../lib/middleware/idempotency';
import { generalRateLimit, expensiveOperationRateLimit, adminRateLimit } from '../lib/middleware/rateLimiting';
// Server configuration modules
import { setupBasicMiddleware, setupViewEngine } from './server/middleware';
import { mountCoreRoutes, mountSaasRoutes, mountDynamicRoutes } from './server/routes';
import { setupFrontendRouting } from './server/frontend';

// Handler modules
import {
  handleHealthCheck,
  handleRunPreview,
  handleCreateRun,
  handleGetRun,
  handleGetRunTimeline,
  handleRunStream,
  handleListRuns,
  handleRetryStep,
  handleGetArtifact
} from './server/handlers';

dotenv.config();

// Initialize the Express application
export const app = express();

// Optional tracing (OpenTelemetry) if enabled via env
initTracing('nofx-api').catch(() => { });

// Dev restart watch (intentionally unused in production) - side effect for file watching
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _devRestartWatch = shouldEnableDevRestartWatch();

// Webhook routes MUST be mounted before express.json() middleware
// because Stripe webhooks need raw body for signature verification
import webhookRoutes from './routes/webhooks';
webhookRoutes(app);

// Public performance monitoring endpoints (mounted BEFORE auth middleware)
import publicPerformanceRoutes from './routes/public-performance';
app.use('/api/public/performance', publicPerformanceRoutes);

// Development admin routes (no auth required, dev only)
import devAdminRoutes from './routes/dev-admin';
app.use('/dev', adminRateLimit, devAdminRoutes);

// Development login route (must be before auth middleware)
import { issueAdminCookie, isAdmin } from '../lib/auth';
app.get('/dev/login', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const next = (req.query.next as string) || '/ui/app/#/runs';
    return res.redirect(`/api/login?next=${encodeURIComponent(next)}`);
  }
  res.setHeader('Set-Cookie', issueAdminCookie());
  const next = (req.query.next as string) || '/ui/settings';
  res.redirect(next);
});

// Debug route to check admin status
app.get('/dev/admin-check', (req, res) => {
  res.json({
    isAdmin: isAdmin(req),
    env: process.env.NODE_ENV,
    enableAdmin: process.env.ENABLE_ADMIN,
    cookies: req.headers.cookie,
    headers: req.headers
  });
});

// Setup middleware stack (includes auth)
setupBasicMiddleware(app);
setupViewEngine(app);

// Apply general rate limiting globally (after basic middleware, before routes)
app.use(generalRateLimit);

// Performance monitoring middleware
app.use(performanceMiddleware());

setupFrontendRouting(app);

// Health check endpoint
app.get("/health", handleHealthCheck);

// TEMPORARY TEST ENDPOINT - NO AUTH
app.post("/test-run", async (req, res) => {
  try {
    const { store } = await import('../lib/store');
    const { enqueue, STEP_READY_TOPIC } = await import('../lib/queue');

    const plan = {
      goal: "write a haiku about debugging code",
      steps: [{
        name: "generate_haiku",
        tool: "codegen",
        inputs: {
          prompt: "Write a haiku (5-7-5 syllables) about debugging code. Make it thoughtful."
        }
      }]
    };

    const run = await store.createRun(plan, 'default');
    const step = await store.createStep(run.id, 'generate_haiku', 'codegen', {
      prompt: "Write a haiku about debugging code"
    });

    await enqueue(STEP_READY_TOPIC, {
      runId: run.id,
      stepId: step.id
    });

    res.json({ id: run.id, status: 'queued', step: step.id });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Unknown error' });
  }
});

// Run management endpoints
app.post('/runs/preview', idempotency(), handleRunPreview);

app.post("/runs",
  idempotency(),
  // requireAuth, // TEMPORARILY DISABLED FOR TESTING
  // checkUsage('runs'), // TEMPORARILY DISABLED FOR TESTING
  // expensiveOperationRateLimit, // TEMPORARILY DISABLED FOR TESTING
  // trackApiUsage('runs', 1), // TEMPORARILY DISABLED FOR TESTING
  handleCreateRun
);

app.get("/runs/:id", handleGetRun);
app.get("/runs/:id/timeline", handleGetRunTimeline);
app.get('/runs/:id/stream', handleRunStream);
app.get('/runs', handleListRuns);
app.post('/runs/:runId/steps/:stepId/retry', idempotency(), requireAuth, handleRetryStep);

// Artifact retrieval endpoint (catch-all route for paths)
app.get('/artifacts/*', handleGetArtifact);

// Mount route modules
mountCoreRoutes(app);
mountSaasRoutes(app);
mountDynamicRoutes(app);

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] || `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Don't log JSON parse errors in test mode - they're expected
  const isTestMode = process.env.NODE_ENV === 'test';
  const isJsonParseError = error instanceof SyntaxError && 'body' in error;

  if (!isTestMode || !isJsonParseError) {
    console.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      correlationId,
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
  }

  // Handle JSON parsing errors specifically
  if (isJsonParseError) {
    res.status(400).json({
      error: 'Invalid JSON in request body',
      correlationId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Don't expose sensitive error details in production
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  res.status(500).json({
    error: 'Internal server error',
    correlationId,
    timestamp: new Date().toISOString(),
    ...(isDev && { details: error.message })
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    timestamp: new Date().toISOString()
  });
});

// Server startup
const port = process.env.PORT || 3002;

let server: http.Server;

export function startServer() {
  return new Promise<http.Server>((resolve, reject) => {
    // Skip server startup during tests to avoid port conflicts
    if (process.env.DISABLE_SERVER_AUTOSTART === '1') {
      // eslint-disable-next-line no-console
      console.log('⚠️ Server autostart disabled (test mode)');
      // Return a mock server object for tests
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockServer = app as any;
      resolve(mockServer);
      return;
    }

    try {
      server = app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`🚀 NOFX API server running on port ${port}`);

        // Initialize services after server starts with timeout
        Promise.race([
          Promise.all([
            initializeIdempotencyCache(),
            initAutoBackupFromSettings(),
            startOutboxRelay()
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service initialization timeout')), 30000)
          )
        ]).then(() => {
          // Start performance monitoring
          performanceMonitor.start();
          // eslint-disable-next-line no-console
          console.log('📊 Performance monitoring started');
          // eslint-disable-next-line no-console
          console.log('✅ All services initialized successfully');
        }).catch(error => {
          // eslint-disable-next-line no-console
          console.error('⚠️ Failed to initialize services:', {
            error: error.message,
            stack: error.stack
          });
          // Continue anyway - server should still serve requests
          // eslint-disable-next-line no-console
          console.log('⚡ Server running in limited mode');
        });

        resolve(server);
      });

      server.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
export function stopServer() {
  return new Promise<void>((resolve, reject) => {
    if (server) {
      // Stop performance monitoring
      performanceMonitor.stop();

      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully');
  stopServer().then(() => {
    process.exit(0);
  }).catch(error => {
    // eslint-disable-next-line no-console
    console.error('Error during shutdown:', error);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('SIGINT received, shutting down gracefully');
  stopServer().then(() => {
    process.exit(0);
  }).catch(error => {
    // eslint-disable-next-line no-console
    console.error('Error during shutdown:', error);
    process.exit(1);
  });
});