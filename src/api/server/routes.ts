/**
 * Route mounting and configuration
 */

import { Express } from 'express';
import { mountRouters } from '../loader';
import builderRoutes from '../routes/builder';
import responsesRoutes from '../routes/responses';
import authV2Routes from '../routes/auth_v2';
import billingRoutes from '../routes/billing';
import teamsRoutes from '../routes/teams';
import performanceRoutes from '../routes/performance';
import superAdminRoutes from '../routes/super-admin';
import uiRoutes from '../routes/ui';
import traceLogRoutes from '../routes/traceLog';
import projectsRoutes from '../routes/projects';
import agentSdkRoutes from '../routes/agent-sdk';
import usageMonitoringRoutes from '../routes/admin/usage-monitoring';

export function mountCoreRoutes(app: Express) {
  // Core NOFX routes
  builderRoutes(app);
  responsesRoutes(app);
  uiRoutes(app);
  traceLogRoutes(app);
  projectsRoutes(app);

  // Performance monitoring routes
  app.use('/api', performanceRoutes);

  // Agent SDK monitoring routes (Phase 3A)
  app.use('/api/sdk', agentSdkRoutes);
}

export function mountSaasRoutes(app: Express) {
  // SaaS authentication and billing routes
  authV2Routes(app);
  billingRoutes(app);
  // Note: webhookRoutes are mounted early in main.ts before express.json()
  teamsRoutes(app);

  // Admin routes
  app.use('/admin/super-admin', superAdminRoutes); // Super admin routes (protected by email check)
  app.use('/admin/usage-monitoring', usageMonitoringRoutes); // Usage monitoring and alerting
}

export function mountDynamicRoutes(app: Express) {
  // Dynamic route loading
  mountRouters(app);
}
