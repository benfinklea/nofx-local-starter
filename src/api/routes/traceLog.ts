import { Express, Router, Request, Response } from 'express';
import fs from 'node:fs';
import { isAdmin } from '../../lib/auth';
import { log } from '../../lib/logger';
import { getTraceStatusSync, refreshTraceStatus, setTraceLogging, logFilePath, logFileExists } from '../../lib/traceConfig';

function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
}

export default function traceLogRoutes(app: Express) {
  const router = Router();

  router.use((req, res, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  });

  router.get('/', async (_req, res) => {
    const status = getTraceStatusSync();
    if (status.source !== 'env') {
      await refreshTraceStatus();
    }
    const refreshed = getTraceStatusSync();
    const filePath = logFilePath();
    const available = logFileExists();
    res.json({
      enabled: refreshed.value,
      source: refreshed.source,
      logFilePath: filePath,
      downloadUrl: '/api/trace-log/download',
      available,
      instructions: [
        'Trace logging writes detailed run diagnostics to the server log stream.',
        `When enabled, logs are mirrored to ${filePath}.`,
        'Use the Download Log button to fetch the current file.',
        'Disable tracing when finished to avoid large log files.'
      ]
    });
  });

  router.post('/', async (req, res) => {
    const enable = Boolean(req.body?.enabled);
    await setTraceLogging(enable);
    log.info({ enable }, 'trace logging toggled via API');
    const status = getTraceStatusSync();
    res.json({ enabled: status.value, source: status.source });
  });

  router.get('/download', (req, res) => {
    const filePath = logFilePath();
    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Log file not found. Enable tracing and try again.' });
      }
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="nofx-trace.log"');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read log file';
      res.status(500).json({ error: message });
    }
  });

  app.use('/api/trace-log', router);
}
