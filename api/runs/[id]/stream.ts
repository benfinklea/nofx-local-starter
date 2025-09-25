import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../../../src/lib/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = req.query.id as string;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Note: Vercel functions have a timeout limit, so for production
  // you may want to use a different approach like WebSockets or
  // a dedicated streaming service

  let closed = false;
  let lastIdx = 0;

  // Handle client disconnect (only if req has the 'on' method - real requests do)
  if (typeof req.on === 'function') {
    req.on('close', () => {
      closed = true;
    });
  }

  // Send initial events
  try {
    const initial = await store.listEvents(runId);
    lastIdx = initial.length;
    res.write(`event: init\n`);
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch (err) {
    // Silently handle initial load errors
  }

  // Poll for updates
  const pollInterval = setInterval(async () => {
    if (closed) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const all = await store.listEvents(runId);
      if (all.length > lastIdx) {
        const delta = all.slice(lastIdx);
        lastIdx = all.length;
        res.write(`event: append\n`);
        res.write(`data: ${JSON.stringify(delta)}\n\n`);
      }
    } catch {
      // Silently handle polling errors
    }
  }, 1000);

  // Note: Vercel functions have a max execution time (default 10s, max 60s on Pro)
  // For long-running streams, consider using Edge Functions or external services
  setTimeout(() => {
    if (!closed) {
      clearInterval(pollInterval);
      res.write(`event: timeout\n`);
      res.write(`data: "Stream timeout"\n\n`);
      res.end();
    }
  }, 55000); // Close before Vercel timeout
}