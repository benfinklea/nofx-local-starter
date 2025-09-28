import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corsMiddleware } from '../middleware/cors';
import { navigationService } from '../../services/navigation/navigationService';
import { logger } from '../../utils/logger';

/**
 * GET /api/navigation/manifest
 * Returns the navigation manifest filtered by user permissions
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS
  await corsMiddleware(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = `nav-manifest-${Date.now()}`;

  try {
    // Load manifest if not already loaded
    await navigationService.loadManifest();

    // Get user context from request (simplified for now)
    // In production, this would come from auth middleware
    const userContext = {
      userId: req.headers['x-user-id'] as string,
      roles: (req.headers['x-user-roles'] as string)?.split(',') || [],
      featureFlags: (req.headers['x-feature-flags'] as string)?.split(',') || [],
    };

    // Get filtered entries based on permissions
    const filteredEntries = await navigationService.getFilteredEntries(userContext);

    // Get the full manifest structure
    const manifest = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      groups: [
        { id: 'main', label: 'Main', order: 0 },
        { id: 'operations', label: 'Operations', order: 1 },
        { id: 'registry', label: 'Registry', order: 2 },
        { id: 'observability', label: 'Observability', order: 3 },
        { id: 'admin', label: 'Administration', order: 4 },
        { id: 'developer', label: 'Developer', order: 5 }
      ],
      entries: filteredEntries,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        build_id: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
        user_id: userContext.userId
      }
    };

    logger.info('Navigation manifest served', {
      correlation_id: correlationId,
      user_id: userContext.userId,
      total_entries: filteredEntries.length,
      user_roles: userContext.roles.length
    });

    // Cache for 5 minutes in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    }

    return res.status(200).json(manifest);
  } catch (error) {
    logger.error('Failed to serve navigation manifest', {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return res.status(500).json({
      error: 'Failed to load navigation manifest',
      correlation_id: correlationId
    });
  }
}