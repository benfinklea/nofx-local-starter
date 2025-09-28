import type { VercelRequest } from '@vercel/node';
import { trackUsage } from '../../src/auth/supabase';

function coerceSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

function extractUserId(req: VercelRequest): string | undefined {
  const header = coerceSingle(req.headers['x-user-id'] as string | string[] | undefined)
    || coerceSingle(req.headers['x-userid'] as string | string[] | undefined);
  if (header && header.trim().length > 0) {
    return header.trim();
  }

  const query = req.query as Record<string, string | string[] | undefined> | undefined;
  if (query) {
    const queryUser = coerceSingle(query.userId) || coerceSingle(query.userid);
    if (queryUser && queryUser.trim().length > 0) {
      return queryUser.trim();
    }
  }

  return undefined;
}

export async function recordRegistryUsage(
  req: VercelRequest,
  metric: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const userId = extractUserId(req);
  if (!userId) return;

  try {
    await trackUsage(userId, metric, 1, metadata);
  } catch (err) {
    console.warn('Failed to record registry usage', { metric, err });
  }
}

export function getRequestUserId(req: VercelRequest): string | undefined {
  return extractUserId(req);
}
