import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from './_lib/cors';

export default withCors(function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});
