import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const ALLOWED_HEADERS = [
  'X-Requested-With',
  'Content-Type',
  'Authorization',
  'X-Project-Id',
  'Accept',
  'Origin',
];

const ENV_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  process.env.API_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  'https://nofx-control-plane.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

const allowedOrigins = new Set<string>([...ENV_ORIGINS, ...DEFAULT_ORIGINS].filter(Boolean) as string[]);
const fallbackOrigin = (() => {
  if (allowedOrigins.size === 0) {
    return undefined;
  }
  const iterator = allowedOrigins.values();
  const first = iterator.next();
  return first.value;
})();

function resolveOrigin(req: VercelRequest): string | undefined {
  const headers = req.headers || {};
  const originRaw = (headers as Record<string, string | string[] | undefined>).origin
    ?? (headers as Record<string, string | string[] | undefined>).Origin;
  const origin = Array.isArray(originRaw) ? originRaw[0] : originRaw;

  if (origin && allowedOrigins.has(origin)) {
    return origin;
  }

  if (!origin) {
    return fallbackOrigin;
  }

  return undefined;
}

export function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = resolveOrigin(req);

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

export function withCors<Handler extends (req: VercelRequest, res: VercelResponse, ...args: any[]) => any>(
  handler: Handler
) {
  return async (req: VercelRequest, res: VercelResponse, ...rest: Parameters<Handler> extends [any, any, ...infer R] ? R : never) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    return handler(req, res, ...rest as any);
  };
}
