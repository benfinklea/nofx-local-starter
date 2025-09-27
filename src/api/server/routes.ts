/**
 * Route mounting and configuration
 */

import { Express } from 'express';
import { mountRouters } from '../loader';
import builderRoutes from '../routes/builder';
import responsesRoutes from '../routes/responses';
import authV2Routes from '../routes/auth_v2';
import billingRoutes from '../routes/billing';
import webhookRoutes from '../routes/webhooks';
import teamsRoutes from '../routes/teams';
import performanceRoutes from '../routes/performance';
import superAdminRoutes from '../routes/super-admin';
import uiRoutes from '../routes/ui';

export function mountCoreRoutes(app: Express) {
  // Core NOFX routes
  builderRoutes(app);
  responsesRoutes(app);
  uiRoutes(app);

  // Performance monitoring routes
  app.use('/api', performanceRoutes);
}

export function mountSaasRoutes(app: Express) {
  // SaaS authentication and billing routes
  authV2Routes(app);
  billingRoutes(app);
  webhookRoutes(app);
  teamsRoutes(app);

  // Super admin routes (protected by email check)
  app.use('/admin/super-admin', superAdminRoutes);
}

export function mountDynamicRoutes(app: Express) {
  // Dynamic route loading
  mountRouters(app);
}