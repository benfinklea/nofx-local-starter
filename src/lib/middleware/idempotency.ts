/**
 * Idempotency Middleware for REST API Endpoints
 * Implements industry-standard idempotency patterns for POST operations
 * Following 2025 best practices from Stripe, PayPal, and other payment processors
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getContext, log } from '../observability';
import { query as pgQuery } from '../db';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  isReplay?: boolean;
}

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  created_at: string;
}

/**
 * Configuration for idempotency middleware
 */
export interface IdempotencyConfig {
  keyHeader?: string;
  keyMaxLength?: number;
  cacheTtlMs?: number;
  generateKey?: boolean;
  skipValidation?: boolean;
}

/**
 * Database schema for idempotency cache
 */
const ENSURE_IDEMPOTENCY_TABLE = `
  CREATE TABLE IF NOT EXISTS nofx.idempotency_cache (
    id uuid primary key default gen_random_uuid(),
    tenant_id text not null default 'local',
    key text not null,
    method text not null,
    path text not null,
    status_code integer not null,
    response_headers jsonb,
    response_body jsonb,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '24 hours'),
    UNIQUE(tenant_id, key, method, path)
  );
  CREATE INDEX IF NOT EXISTS idempotency_cache_expires_idx
    ON nofx.idempotency_cache(expires_at);
`;

/**
 * Initialize idempotency cache table
 */
export async function initializeIdempotencyCache(): Promise<void> {
  try {
    await pgQuery(ENSURE_IDEMPOTENCY_TABLE);
    log.debug({ event: 'idempotency.cache.initialized' }, 'Idempotency cache table ready');
  } catch (error) {
    log.error({
      event: 'idempotency.cache.init_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to initialize idempotency cache');
    throw error;
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await pgQuery(
      'DELETE FROM nofx.idempotency_cache WHERE expires_at < now()'
    );
    const deletedCount = (result as any).rowCount || 0;

    if (deletedCount > 0) {
      log.debug({
        event: 'idempotency.cache.cleanup',
        deletedCount
      }, 'Cleaned up expired idempotency cache entries');
    }

    return deletedCount;
  } catch (error) {
    log.warn({
      event: 'idempotency.cache.cleanup_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to cleanup expired cache entries');
    return 0;
  }
}

/**
 * Validate idempotency key format
 */
function validateIdempotencyKey(key: string, config: IdempotencyConfig): void {
  const maxLength = config.keyMaxLength || 255;

  if (!key) {
    throw new Error('Idempotency key cannot be empty');
  }

  if (key.length > maxLength) {
    throw new Error(`Idempotency key cannot exceed ${maxLength} characters`);
  }

  // Ensure key has sufficient entropy (basic check)
  if (key.length < 8) {
    throw new Error('Idempotency key must be at least 8 characters for sufficient entropy');
  }

  // Basic character validation (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new Error('Idempotency key contains invalid characters');
  }
}

/**
 * Store response in idempotency cache
 */
async function cacheResponse(
  key: string,
  method: string,
  path: string,
  statusCode: number,
  headers: Record<string, string>,
  body: any,
  tenantId: string = 'local'
): Promise<void> {
  try {
    await pgQuery(
      `INSERT INTO nofx.idempotency_cache
       (tenant_id, key, method, path, status_code, response_headers, response_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, key, method, path) DO NOTHING`,
      [tenantId, key, method, path, statusCode, headers, body]
    );

    log.debug({
      event: 'idempotency.response.cached',
      key,
      method,
      path,
      statusCode
    }, 'Cached idempotent response');
  } catch (error) {
    log.warn({
      event: 'idempotency.cache.store_failed',
      key,
      method,
      path,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to cache idempotent response');
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Retrieve cached response
 */
async function getCachedResponse(
  key: string,
  method: string,
  path: string,
  tenantId: string = 'local'
): Promise<CachedResponse | null> {
  try {
    const result = await pgQuery<CachedResponse>(
      `SELECT status_code as status, response_headers as headers,
              response_body as body, created_at
       FROM nofx.idempotency_cache
       WHERE tenant_id = $1 AND key = $2 AND method = $3 AND path = $4
         AND expires_at > now()
       LIMIT 1`,
      [tenantId, key, method, path]
    );

    return result.rows[0] || null;
  } catch (error) {
    log.warn({
      event: 'idempotency.cache.retrieve_failed',
      key,
      method,
      path,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to retrieve cached response');
    return null;
  }
}

/**
 * Express middleware for handling idempotent requests
 */
export function idempotency(config: IdempotencyConfig = {}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    keyHeader = 'x-idempotency-key',
    generateKey = false,
    skipValidation = false
  } = config;

  return async (req: IdempotentRequest, res: Response, next: NextFunction): Promise<void> => {
    const ctx = getContext();
    const correlationId = ctx?.correlationId;

    try {
      // Only apply to POST, PUT, PATCH methods
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
      }

      // Extract idempotency key from headers
      let idempotencyKey = req.headers[keyHeader.toLowerCase()] as string;

      // Check if header was provided (even if empty string)
      const headerProvided = keyHeader.toLowerCase() in req.headers;

      // If header not provided, generate or skip
      if (!headerProvided) {
        if (generateKey) {
          idempotencyKey = `auto_${randomUUID()}`;
          log.debug({
            event: 'idempotency.key.generated',
            key: idempotencyKey,
            correlationId
          }, 'Generated idempotency key');
        } else {
          log.debug({
            event: 'idempotency.key.missing',
            method: req.method,
            path: req.path,
            correlationId
          }, 'No idempotency key provided');
          return next();
        }
      } else {
        // Header was provided, validate it (even if empty string)
        if (!skipValidation) {
          try {
            validateIdempotencyKey(idempotencyKey, config);
          } catch (error) {
            log.warn({
              event: 'idempotency.key.invalid',
              key: idempotencyKey,
              error: error instanceof Error ? error.message : 'Unknown error',
              correlationId
            }, 'Invalid idempotency key provided');

            res.status(400).json({
              type: 'urn:nofx:error:invalid-idempotency-key',
              title: 'Invalid Idempotency Key',
              status: 400,
              detail: error instanceof Error ? error.message : 'Invalid idempotency key format',
              correlationId
            });
            return;
          }
        }
      }

      // Attach key to request for use by handlers
      req.idempotencyKey = idempotencyKey;

      // Check for cached response
      const cached = await getCachedResponse(idempotencyKey, req.method, req.path);

      if (cached) {
        log.info({
          event: 'idempotency.response.replayed',
          key: idempotencyKey,
          method: req.method,
          path: req.path,
          cachedStatus: cached.status,
          correlationId
        }, 'Replaying cached idempotent response');

        // Set cached headers
        if (cached.headers) {
          Object.entries(cached.headers).forEach(([name, value]) => {
            res.setHeader(name, value);
          });
        }

        // Add replay header
        res.setHeader('x-idempotency-replayed', 'true');
        res.setHeader('x-idempotency-original-date', cached.created_at);

        req.isReplay = true;
        res.status(cached.status).json(cached.body);
        return;
      }

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      let responseCached = false;

      const cacheResponseData = async (body: any) => {
        if (responseCached) return;
        responseCached = true;

        // Only cache successful responses and client errors (not server errors)
        if (res.statusCode < 500) {
          const headers: Record<string, string> = {};
          Object.entries(res.getHeaders()).forEach(([name, value]) => {
            if (typeof value === 'string') {
              headers[name] = value;
            }
          });

          await cacheResponse(
            idempotencyKey!,
            req.method,
            req.path,
            res.statusCode,
            headers,
            body
          );
        }
      };

      // Override json method
      res.json = function(body: any) {
        // Cache in background, don't wait for it (only if not already cached)
        if (!responseCached) {
          cacheResponseData(body).catch(() => {
            // Silently ignore cache errors
          });
        }
        // Call original immediately
        return originalJson(body);
      };

      // Override send method
      res.send = function(body: any) {
        // Cache in background, don't wait for it (only if not already cached)
        if (!responseCached) {
          cacheResponseData(body).catch(() => {
            // Silently ignore cache errors
          });
        }
        // Call original immediately
        return originalSend(body);
      };

      log.debug({
        event: 'idempotency.request.processing',
        key: idempotencyKey,
        method: req.method,
        path: req.path,
        correlationId
      }, 'Processing idempotent request');

      next();

    } catch (error) {
      log.error({
        event: 'idempotency.middleware.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        correlationId
      }, 'Error in idempotency middleware');

      // Continue without idempotency on middleware errors
      next();
    }
  };
}

/**
 * Helper function to check if request is idempotent replay
 */
export function isIdempotentReplay(req: IdempotentRequest): boolean {
  return req.isReplay === true;
}

/**
 * Helper function to get idempotency key from request
 */
export function getIdempotencyKey(req: IdempotentRequest): string | undefined {
  return req.idempotencyKey;
}