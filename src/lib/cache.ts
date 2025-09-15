import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

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
      try { await fsp.unlink(file); } catch {}
      return null;
    }
    return data?.value ?? null;
  } catch { return null; }
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
      try { await fsp.unlink(path.join(dir, f)); n++; } catch {}
    }
    return n;
  } catch { return 0; }
}
