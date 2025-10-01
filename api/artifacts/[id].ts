import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../src/lib/auth';
import { withCors } from '../_lib/cors';
import { supabase, ARTIFACT_BUCKET } from '../../src/lib/supabase';
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

    // Try Supabase Storage first (if configured)
    const storage = supabase?.storage;
    if (storage && typeof storage.from === 'function') {
      try {
        const bucket = storage.from(ARTIFACT_BUCKET);
        if (bucket && typeof bucket.download === 'function') {
          const { data, error } = await bucket.download(normalizedPath);
          if (!error && data) {
            const content = await data.text();
            return res.json({
              path: artifactPath,
              content,
              size: data.size
            });
          }
        }
      } catch (err) {
        console.warn('[Artifacts] Supabase download failed, trying local filesystem:', err);
      }
    }

    // Fallback to local filesystem
    const fullPath = path.join(process.cwd(), 'local_data', normalizedPath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'Artifact not found in storage' });
    }

    // Read file content
    const content = await fs.readFile(fullPath, 'utf-8');

    // Get file stats for metadata
    const stats = await fs.stat(fullPath);

    return res.json({
      path: artifactPath,
      content,
      size: stats.size
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artifact';
    return res.status(500).json({ error: message });
  }
});
