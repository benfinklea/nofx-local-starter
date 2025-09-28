import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear auth cookies
  res.setHeader('Set-Cookie', [
    'sb-access-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'sb-refresh-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  ]);

  return res.status(200).json({ message: 'Logged out successfully' });
});
