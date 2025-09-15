import fs from 'node:fs';
import path from 'node:path';
import type { StepHandler } from './types';

export function loadHandlers(): StepHandler[] {
  const dir = __dirname;
  const handlers: StepHandler[] = [];
  const all = fs.readdirSync(dir);
  const files = (process.env.NODE_ENV === 'test')
    ? all.filter(f => /^(test[_.].*|.*test.*)\.(ts|js)$/.test(f))
    : all;
  for (const file of files) {
    if (!/\.(ts|js)$/.test(file)) continue;
    if (['loader.ts','types.ts'].includes(file)) continue;
    const mod = require(path.join(dir, file));
    const h: StepHandler | undefined = mod.default || mod.handler;
    if (h && typeof h.run === 'function' && typeof h.match === 'function') handlers.push(h);
  }
  return handlers;
}
