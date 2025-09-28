import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../auth-middleware';
import { withCors } from '../_lib/cors';

// Get current user endpoint - protected by auth middleware
export default withCors(withAuth(async (req: VercelRequest, res: VercelResponse, user: any) => {
  res.status(200).json({ user });
}));
