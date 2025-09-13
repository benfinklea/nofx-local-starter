import crypto from 'node:crypto';
import type { Request } from 'express';

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

export function isAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret';
  const cookies = parseCookies(req.headers.cookie as string|undefined);
  const c = cookies[COOKIE_NAME];
  if (!c) return false;
  const [value, sig] = c.split('|');
  if (!value || !sig) return false;
  return sig === hmac(value, secret);
}

