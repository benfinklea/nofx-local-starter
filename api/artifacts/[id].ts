import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../src/lib/auth';
import { withCors } from '../_lib/cors';
import path from 'node:path';
import fs from 'node:fs/promises';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const artifactPath = req.query.id as string;

  if (!artifactPath) {
    return res.status(400).json({ error: 'Artifact path is required' });
  }

  try {
    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(artifactPath);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      return res.status(403).json({ error: 'Invalid artifact path' });
    }

    // Construct full path relative to project root
    const fullPath = path.join(process.cwd(), normalizedPath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Read file content
    const content = await fs.readFile(fullPath, 'utf-8');

    // Get file stats for metadata
    const stats = await fs.stat(fullPath);

    return res.json({
      path: artifactPath,
      content,
      size: stats.size,
      modified: stats.mtime.toISOString()
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artifact';
    return res.status(500).json({ error: message });
  }
});
