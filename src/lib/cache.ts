import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { log } from './observability';

const ROOT = path.join(process.cwd(), 'local_data', 'cache');

function ensureDirSync(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function fileFor(ns: string, key: string) {
  const safeNs = ns.replace(/[^a-z0-9_.:-]/gi, '_');
  const h = crypto.createHash('sha256').update(key).digest('hex');
  const dir = path.join(ROOT, safeNs);
  ensureDirSync(dir);
  return path.join(dir, `${h}.json`);
}

export async function getCacheJSON<T=unknown>(ns: string, key: string): Promise<T | null> {
  try {
    const file = fileFor(ns, key);
    const s = await fsp.readFile(file, 'utf8');
    const data = JSON.parse(s);
    const exp = Number(data?.expiresAt || 0);
    if (exp && Date.now() > exp) {
      // expired; best-effort unlink
      try {
        await fsp.unlink(file);
      } catch (error) {
        log.warn({
          error,
          context: { ns, key, file, operation: 'deleteExpiredCache' }
        }, 'Failed to delete expired cache file');
      }
      return null;
    }
    return data?.value ?? null;
  } catch (error) {
    log.debug({
      error,
      context: { ns, key, operation: 'getCacheJSON' }
    }, 'Cache read failed - expected for cache misses');
    return null;
  }
}

export async function setCacheJSON(ns: string, key: string, value: unknown, ttlMs: number): Promise<void> {
  const file = fileFor(ns, key);
  const expiresAt = Date.now() + Math.max(0, Number(ttlMs || 0));
  const data = { expiresAt, value };
  await fsp.writeFile(file, JSON.stringify(data));
}

export async function invalidateNamespace(ns: string): Promise<number> {
  const dir = path.join(ROOT, ns);
  try {
    const files = await fsp.readdir(dir);
    let n = 0;
    for (const f of files) {
      try {
        await fsp.unlink(path.join(dir, f));
        n++;
      } catch (error) {
        log.warn({
          error,
          context: { ns, file: f, operation: 'invalidateNamespaceFile' }
        }, 'Failed to delete cache file during namespace invalidation');
      }
    }
    return n;
  } catch (error) {
    log.debug({
      error,
      context: { ns, dir, operation: 'invalidateNamespace' }
    }, 'Failed to invalidate cache namespace - directory may not exist');
    return 0;
  }
}
