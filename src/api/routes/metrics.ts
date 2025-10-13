import type { Express } from 'express';
import { metrics } from '../../lib/metrics';

export default function mount(app: Express){
  app.get('/metrics', async (_req, res): Promise<void> => {
    try {
      const body = await metrics.render();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return res.status(200).send(body);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'metrics unavailable';
      return res.status(500).send(`# metrics error\n# ${message}\n`);
    }
  });
}

