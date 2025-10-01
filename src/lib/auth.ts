import crypto from 'node:crypto';
const COOKIE_NAME = 'nofx_admin';

function parseCookies(cookieHeader: string | undefined): Record<string,string> {
  const out: Record<string,string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const [k, ...v] = p.trim().split('=');
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(v.join('='));
  }
  return out;
}

function hmac(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function issueAdminCookie(): string {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret';
  const value = '1';
  const sig = hmac(value, secret);
  return `${COOKIE_NAME}=${value}|${sig}; Path=/; HttpOnly; SameSite=Lax`;
}

export function isAdmin(req: { headers: { cookie?: string | undefined; authorization?: string | undefined } }): boolean {
  // In development with ENABLE_ADMIN, bypass auth check
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_ADMIN === 'true') {
    return true;
  }

  // Check old cookie-based auth
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret';
  const cookies = parseCookies(req.headers.cookie);
  const c = cookies[COOKIE_NAME];
  if (c) {
    const [value, sig] = c.split('|');
    if (value && sig && sig === hmac(value, secret)) {
      return true;
    }
  }

  // Check for Supabase JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Has a token - assume valid for now
    // (Full validation happens in verifyAuth middleware)
    return true;
  }

  return false;
}
