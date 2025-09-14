import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';

type RouteModule = { default?: unknown; router?: unknown; mount?: unknown };

export function mountRouters(app: Express) {
  const dir = path.join(__dirname, 'routes');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(ts|js)$/.test(file)) continue;
    const modPath = path.join(dir, file);
    // Use dynamic import to avoid require()
    import(modPath)
      .then((mod: RouteModule) => {
        const mount = (mod.default ?? mod.router ?? mod.mount);
        if (typeof mount === 'function') {
          (mount as (a: Express) => void)(app);
        }
      })
      .catch(() => {
        // ignore failed dynamic import
      });
  }
}
