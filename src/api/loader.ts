import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';

export function mountRouters(app: Express) {
  const dir = path.join(__dirname, 'routes');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(ts|js)$/.test(file)) continue;
    const mod = require(path.join(dir, file));
    const mount = mod.default || mod.router || mod.mount;
    if (typeof mount === 'function') {
      mount(app);
    }
  }
}