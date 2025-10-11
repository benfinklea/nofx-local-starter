/**
 * Artifact retrieval handlers
 */

import type { Request, Response } from 'express';
import { store } from '../../../lib/store';
import { supabase, ARTIFACT_BUCKET } from '../../../lib/supabase';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

/**
 * GET /artifacts/:path*
 * Retrieve artifact content by path
 */
export async function handleGetArtifact(req: Request, res: Response) {
  try {
    // Extract the full path from params (catch-all route)
    const artifactPath = req.params[0] || req.params.path || '';

    if (!artifactPath) {
      return res.status(400).json({ error: 'Artifact path is required' });
    }

    // For filesystem storage driver
    if (store.driver === 'fs') {
      const basePath = path.resolve(process.cwd(), 'local_data');
      const fullPath = path.resolve(basePath, artifactPath.replace(/^\/+/, ''));

      // Security: Prevent path traversal
      if (!fullPath.startsWith(basePath + path.sep) && fullPath !== basePath) {
        return res.status(400).json({ error: 'Invalid artifact path' });
      }

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      // Read file content
      const content = await fsp.readFile(fullPath, 'utf8');
      const stats = await fsp.stat(fullPath);

      return res.json({
        content,
        path: artifactPath,
        size: stats.size
      });
    }

    // For Supabase storage driver
    if (!supabase) {
      return res.status(500).json({ error: 'Storage not configured' });
    }

    const { data, error } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .download(artifactPath);

    if (error || !data) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const content = await data.text();
    const size = data.size;

    return res.json({
      content,
      path: artifactPath,
      size
    });
  } catch (error) {
    console.error('Error retrieving artifact:', error);
    return res.status(500).json({
      error: 'Failed to retrieve artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
