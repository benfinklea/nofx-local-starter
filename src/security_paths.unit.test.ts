import { describe, it, expect, beforeAll } from 'vitest';
import type { Express, Request, Response } from 'express';
import { accessSync } from 'node:fs';
import path from 'node:path';

describe('Path safety: artifacts route', () => {
  let app: Express;
  let handler: ((req: Request, res: Response) => any) | undefined;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_DRIVER = 'fs';
    const mod = await import('./api/main');
    app = mod.app;
    const uiMod: any = await import('./api/routes/ui');
    const mount = uiMod?.default ?? uiMod?.mount;
    if (typeof mount === 'function') {
      mount(app);
    }
    const stack: any[] = (app as any)?._router?.stack || [];
    handler = stack
      .map(layer => layer?.route)
      .filter(Boolean)
      .find((route: any) => route?.path === '/ui/artifacts/signed')
      ?.stack?.[0]?.handle;
    if (typeof handler !== 'function') {
      throw new Error('artifacts handler not mounted');
    }
  });

  async function invokeArtifacts(query: Record<string, unknown>) {
    if (!handler) throw new Error('handler missing');
    const req = { query } as unknown as Request;
    const result: { status: number; body?: unknown; filePath?: string } = { status: 200 };
    const res = {
      status(code: number) {
        result.status = code;
        return this;
      },
      send(payload: unknown) {
        result.body = payload;
        return this;
      },
      redirect() {
        throw new Error('redirect not expected');
      },
      sendFile(filePath: string, cb?: (err?: unknown) => void) {
        result.filePath = filePath;
        try {
          accessSync(filePath);
          cb?.();
        } catch (err) {
          cb?.(err);
        }
        return this;
      },
    } as unknown as Response;

    await handler(req, res);
    return result;
  }

  it('rejects traversal outside local_data', async () => {
    const res = await invokeArtifacts({ path: '../../etc/passwd' });
    expect([400, 404]).toContain(res.status);
  });

  it('serves an existing artifact path under local_data', async () => {
    const fs = await import('node:fs/promises');
    const { store } = await import('./lib/store');
    expect(store.driver).toBe('fs');
    const rel = path.join('runs','t-run','steps','t-step','hello.txt');
    const full = path.join(process.cwd(), 'local_data', rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, 'ok', 'utf8');
    await expect(fs.access(full)).resolves.toBeUndefined();

    const res = await invokeArtifacts({ path: rel });
    expect(res.status).toBe(200);
    expect(res.filePath && path.resolve(res.filePath)).toBe(path.resolve(full));
  });
});

describe('Path safety: git_pr commit path resolution', () => {
  it('safeRepoPath prevents absolute and traversal paths', async () => {
    const mod = await import('./worker/handlers/git_pr');
    const { safeRepoPath } = mod;
    const root = process.cwd();
    // valid
    const p1 = safeRepoPath(root, 'docs/README.md');
    expect(p1.startsWith(root)).toBe(true);
    // traversal
    expect(() => safeRepoPath(root, '../../etc/passwd')).toThrow();
    // absolute
    expect(() => safeRepoPath(root, '/etc/passwd')).toThrow();
  });
});
