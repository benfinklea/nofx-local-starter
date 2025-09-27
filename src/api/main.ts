/**
 * NOFX API Server - Refactored using Compose Methods pattern
 * Now organized into focused, single-purpose modules
 */

import express from "express";
import dotenv from "dotenv";
import http from 'node:http';
import { requireAuth, checkUsage, rateLimit, trackApiUsage } from '../auth/middleware';
import { initAutoBackupFromSettings } from '../lib/autobackup';
import startOutboxRelay from '../worker/relay';
import { initTracing } from '../lib/tracing';
import { shouldEnableDevRestartWatch } from '../lib/devRestart';
import { performanceMiddleware, performanceMonitor } from '../lib/performance-monitor';

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
  handleRetryStep
} from './server/handlers';

dotenv.config();

// Initialize the Express application
export const app = express();

// Optional tracing (OpenTelemetry) if enabled via env
initTracing('nofx-api').catch(() => { });

const _devRestartWatch = shouldEnableDevRestartWatch();

// Public performance monitoring endpoints (mounted BEFORE auth middleware)
import publicPerformanceRoutes from './routes/public-performance';
app.use('/api/public/performance', publicPerformanceRoutes);

// Development admin routes (no auth required, dev only)
import devAdminRoutes from './routes/dev-admin';
app.use('/dev', devAdminRoutes);

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

// Performance monitoring middleware
app.use(performanceMiddleware());

setupFrontendRouting(app);

// Health check endpoint
app.get("/health", handleHealthCheck);

// Run management endpoints
app.post('/runs/preview', handleRunPreview);

app.post("/runs",
  requireAuth,
  checkUsage('runs'),
  rateLimit(60000, 100), // 100 requests per minute max
  trackApiUsage('runs', 1),
  handleCreateRun
);

app.get("/runs/:id", handleGetRun);
app.get("/runs/:id/timeline", handleGetRunTimeline);
app.get('/runs/:id/stream', handleRunStream);
app.get('/runs', handleListRuns);
app.post('/runs/:runId/steps/:stepId/retry', requireAuth, handleRetryStep);

// Mount route modules
mountCoreRoutes(app);
mountSaasRoutes(app);
mountDynamicRoutes(app);

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    correlationId,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent']
  });

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
    try {
      server = app.listen(port, () => {
        console.log(`🚀 NOFX API server running on port ${port}`);

        // Initialize services after server starts with timeout
        Promise.race([
          Promise.all([
            initAutoBackupFromSettings(),
            startOutboxRelay()
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service initialization timeout')), 30000)
          )
        ]).then(() => {
          // Start performance monitoring
          performanceMonitor.start();
          console.log('📊 Performance monitoring started');
          console.log('✅ All services initialized successfully');
        }).catch(error => {
          console.error('⚠️ Failed to initialize services:', {
            error: error.message,
            stack: error.stack
          });
          // Continue anyway - server should still serve requests
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
  console.log('SIGTERM received, shutting down gracefully');
  stopServer().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Error during shutdown:', error);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopServer().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Error during shutdown:', error);
    process.exit(1);
  });
});