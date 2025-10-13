/**
 * Artifact retrieval handlers
 */

import type { Request, Response } from 'express';
import { supabase, ARTIFACT_BUCKET } from '../../../lib/supabase';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

/**
 * GET /artifacts/:path*
 * Retrieve artifact content by path
 */
export async function handleGetArtifact(req: Request, res: Response): Promise<void> {
  try {
    // Extract the full path from params (catch-all route)
    const artifactPath = req.params[0] || req.params.path || '';

    if (!artifactPath) {
      res.status(400).json({ error: 'Artifact path is required' });
      return;
    }

    // Try Supabase storage first (artifacts may be stored there even with fs driver)
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(ARTIFACT_BUCKET)
          .download(artifactPath);

        if (!error && data) {
          // Supabase-js returns different types depending on version/environment
          let content: string;
          let size: number;

          // Try different methods to read the data
          if (data.constructor?.name === 'Buffer' || Buffer.isBuffer(data)) {
            // It's already a Buffer
            content = (data as Buffer).toString('utf8');
            size = (data as Buffer).length;
          } else if (data instanceof Uint8Array) {
            // It's a Uint8Array
            const buffer = Buffer.from(data);
            content = buffer.toString('utf8');
            size = buffer.length;
          } else {
            // Last resort: use node-fetch Response stream
            const chunks: Uint8Array[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reader = (data as any).stream?.().getReader();
            if (reader) {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
              }
              const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
              content = buffer.toString('utf8');
              size = buffer.length;
            } else {
              throw new Error(`Unknown data type: ${typeof data}`);
            }
          }

          res.json({
            content,
            path: artifactPath,
            size
          });
          return;
        }
      } catch (_supabaseError) {
        // Fall through to filesystem check (Supabase not available or file not found)
      }
    }

    // Fall back to filesystem storage
    const basePath = path.resolve(process.cwd(), 'local_data');
    const cleanPath = artifactPath.replace(/^\/+/, ''); // Remove leading slashes
    const fullPath = path.join(basePath, cleanPath);

    // Security: Prevent path traversal
    if (!fullPath.startsWith(basePath + path.sep) && fullPath !== basePath) {
      res.status(400).json({ error: 'Invalid artifact path' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    // Read file content
    const content = await fsp.readFile(fullPath, 'utf8');
    const stats = await fsp.stat(fullPath);

    res.json({
      content,
      path: artifactPath,
      size: stats.size
    });
  } catch (error) {
    console.error('Error retrieving artifact:', error);
    res.status(500).json({
      error: 'Failed to retrieve artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
