import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../auth-middleware';

// Get current user endpoint - protected by auth middleware
export default withAuth(async (req: VercelRequest, res: VercelResponse, user: any) => {
  return res.status(200).json({ user });
});