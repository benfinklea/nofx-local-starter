import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Path safety: artifacts route', () => {
  let app: Express;

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
  });

  it('rejects traversal outside local_data', async () => {
    const res = await request(app)
      .get('/ui/artifacts/signed')
      .query({ path: '../../etc/passwd' });
    expect([400,404]).toContain(res.status);
  });

  it('serves an existing artifact path under local_data', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { store } = await import('./lib/store');
    expect(store.driver).toBe('fs');
    const rel = path.join('runs','t-run','steps','t-step','hello.txt');
    const full = path.join(process.cwd(), 'local_data', rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, 'ok', 'utf8');
    await expect(fs.access(full)).resolves.toBeUndefined();

    const res = await request(app)
      .get('/ui/artifacts/signed')
      .query({ path: rel });
    expect(res.status).toBe(200);
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
