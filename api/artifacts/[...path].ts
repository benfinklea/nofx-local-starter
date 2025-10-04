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

  // Handle catch-all path parameter
  const pathArray = req.query.path;
  const artifactPath = Array.isArray(pathArray) ? pathArray.join('/') : pathArray as string;

  console.log('[Artifacts API] Request for artifact:', { pathArray, artifactPath, query: req.query });

  if (!artifactPath) {
    return res.status(400).json({ error: 'Artifact path is required' });
  }

  try {
    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(artifactPath);
    console.log('[Artifacts API] Normalized path:', normalizedPath);

    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      console.warn('[Artifacts API] Path traversal attempt blocked:', normalizedPath);
      return res.status(403).json({ error: 'Invalid artifact path' });
    }

    // Try Supabase Storage first (if configured)
    const storage = supabase?.storage;
    console.log('[Artifacts API] Checking Supabase storage:', { hasStorage: !!storage, bucket: ARTIFACT_BUCKET });

    if (storage && typeof storage.from === 'function') {
      try {
        const bucket = storage.from(ARTIFACT_BUCKET);
        console.log('[Artifacts API] Attempting download from bucket:', ARTIFACT_BUCKET, 'path:', normalizedPath);

        if (bucket && typeof bucket.download === 'function') {
          const { data, error } = await bucket.download(normalizedPath);
          console.log('[Artifacts API] Download result:', { hasData: !!data, error: error?.message });

          if (!error && data) {
            try {
              const content = await data.text();
              console.log('[Artifacts API] Successfully loaded from Supabase:', { pathLength: normalizedPath.length, contentLength: content.length });
              return res.json({
                path: artifactPath,
                content,
                size: data.size
              });
            } catch (textError) {
              console.warn('[Artifacts] Failed to decode artifact as text:', textError);
              // Try as binary/blob if text() fails
              const arrayBuffer = await data.arrayBuffer();
              const content = Buffer.from(arrayBuffer).toString('utf-8');
              return res.json({
                path: artifactPath,
                content,
                size: data.size
              });
            }
          } else if (error) {
            console.warn('[Artifacts API] Supabase storage error:', error);
          }
        }
      } catch (err) {
        console.warn('[Artifacts API] Supabase download failed, trying local filesystem:', err);
      }
    } else {
      console.log('[Artifacts API] Supabase storage not available, skipping to filesystem');
    }

    // Fallback to local filesystem
    const fullPath = path.join(process.cwd(), 'local_data', normalizedPath);
    console.log('[Artifacts API] Trying local filesystem:', fullPath);

    // Check if file exists
    try {
      await fs.access(fullPath);
      console.log('[Artifacts API] File exists in local filesystem');
    } catch {
      console.warn('[Artifacts API] File not found in local filesystem:', fullPath);
      return res.status(404).json({ error: 'Artifact not found in storage' });
    }

    // Read file content
    const content = await fs.readFile(fullPath, 'utf-8');

    // Get file stats for metadata
    const stats = await fs.stat(fullPath);

    console.log('[Artifacts API] Successfully loaded from filesystem:', { size: stats.size, contentLength: content.length });

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
