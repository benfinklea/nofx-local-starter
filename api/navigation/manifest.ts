/**
 * Navigation Manifest API Endpoint (Vercel Serverless)
 * Returns the navigation structure for the frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../_lib/cors';

async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return a simple navigation manifest
    const manifest = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      groups: [
        {
          id: 'main',
          label: 'Main',
          order: 0
        }
      ],
      items: [
        {
          id: 'runs',
          path: '/runs',
          label: 'Runs',
          icon: 'PlayArrow',
          groupId: 'main',
          order: 0
        },
        {
          id: 'projects',
          path: '/projects',
          label: 'Projects',
          icon: 'Folder',
          groupId: 'main',
          order: 1
        },
        {
          id: 'settings',
          path: '/settings',
          label: 'Settings',
          icon: 'Settings',
          groupId: 'main',
          order: 2
        }
      ],
      overrides: [],
      settings: {
        showBreadcrumbs: true,
        showSearch: true,
        enableShortcuts: true,
        sidebarCollapsed: false,
        mobileBreakpoint: 768,
        tabletBreakpoint: 1024
      }
    };

    // Set proper JSON content type
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(manifest);

  } catch (error) {
    console.error('Navigation manifest error:', error);
    return res.status(500).json({ error: 'Failed to load navigation manifest' });
  }
}

export default withCors(handler);
