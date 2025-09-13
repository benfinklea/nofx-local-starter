# 00_BASE — Parallel‑Ready Refactor (run this first)

## Goal
Make the repo safe for parallel work by:
- Introducing a **router auto‑loader** so other tasks add routes without editing `src/api/main.ts`
- Refactoring the **queue** into adapters with a stable import
- Refactoring the **worker** to a **handler plugin** model so new features add handlers without editing `runner.ts`
- Pre‑adding all shared dependencies to avoid `package.json` conflicts

## 1) package.json (single, consolidated change)
Update **once** to include all deps and scripts used by later tasks.

**Edit `package.json`** — merge the following keys:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "bullmq": "^5.7.8",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "ioredis": "^5.4.1",
    "openai": "^4.56.0",
    "pg": "^8.12.0",
    "pino": "^9.4.0",
    "zod": "^3.23.8",
    "ejs": "^3.1.10",
    "@anthropic-ai/sdk": "^0.25.1",
    "@google/generative-ai": "^0.15.0",
    "@aws-sdk/client-sqs": "^3.637.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.5.4",
    "npm-run-all": "^4.1.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "@vitest/coverage-v8": "^2.0.5",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^8.3.0",
    "@typescript-eslint/eslint-plugin": "^8.3.0",
    "eslint-formatter-json": "^8.40.0"
  },
  "scripts": {
    "dev:api": "ts-node-dev --respawn --transpile-only src/api/main.ts",
    "dev:worker": "ts-node-dev --respawn --transpile-only src/worker/main.ts",
    "dev": "npm-run-all -p dev:*",
    "create:bucket": "ts-node-dev --transpile-only scripts/createBucket.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint --format=json --ext .ts src",
    "test": "vitest run --coverage",
    "gate:typecheck": "node ./scripts/runGate.js typecheck",
    "gate:lint": "node ./scripts/runGate.js lint",
    "gate:unit": "node ./scripts/runGate.js unit",
    "gates": "npm run gate:typecheck && npm run gate:lint && npm run gate:unit"
  }
}
```

Then run:
```bash
npm install
```

## 2) API router auto‑loader
Create `src/api/loader.ts`:
```ts
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
```

**Edit `src/api/main.ts`** to call the loader (add near the top and after `.use(express.json(...))`):
```ts
// ADD imports
import path from 'node:path';
import { mountRouters } from './loader';

// ADD view engine + static for future UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'ui', 'views'));
app.use('/ui/static', express.static(path.join(__dirname, '..', 'ui', 'static')));

// ADD at the end of file, after existing routes:
mountRouters(app);
```

> Do **not** remove existing `/runs` routes. Other tasks will add their own routers in `src/api/routes/` and get auto‑mounted.

## 3) Queue adapters
Create **directory** `src/lib/queue/` and move the Redis logic into an adapter.

Create `src/lib/queue/RedisAdapter.ts` (copy from the current `src/lib/queue.ts` implementation):
```ts
import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { log } from "../logger";

export class RedisQueueAdapter {
  connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  queues = new Map<string, Queue>();

  private getQueue(topic: string) {
    if (!this.queues.has(topic)) {
      this.queues.set(topic, new Queue(topic, { connection: this.connection }));
    }
    return this.queues.get(topic)!;
  }
  async enqueue(topic: string, payload: any, options?: JobsOptions) {
    await this.getQueue(topic).add("job", payload, options);
    log.info({ topic, payload }, "enqueued");
  }
  subscribe(topic: string, handler: (payload:any)=>Promise<void>) {
    // eslint-disable-next-line no-new
    new Worker(topic, async (job) => {
      await handler(job.data);
    }, { connection: this.connection });
    log.info({ topic }, "subscribed");
  }
}
```

Create `src/lib/queue/index.ts`:
```ts
import { RedisQueueAdapter } from "./RedisAdapter";
const DRIVER = (process.env.QUEUE_DRIVER || 'redis').toLowerCase();
let impl: any;
if (DRIVER === 'redis') impl = new RedisQueueAdapter();
export const STEP_READY_TOPIC = "step.ready";
export const enqueue = (topic:string, payload:any)=>impl.enqueue(topic,payload);
export const subscribe = (topic:string, handler:(p:any)=>Promise<void>)=>impl.subscribe(topic,handler);
```

**Replace** the old passthrough with a tiny shim so legacy imports work:
Create/overwrite `src/lib/queue.ts`:
```ts
export * from './queue/index';
```

No other files should import adapters directly; always import from `../lib/queue`.

## 4) Worker handler plugin model
Create `src/worker/handlers/types.ts`:
```ts
export interface Step {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  inputs: any;
}
export interface StepHandler {
  /** match a tool exactly or by regex */
  match(tool: string): boolean;
  run(ctx: { runId: string; step: Step }): Promise<void>;
}
```

Create `src/worker/handlers/loader.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import type { StepHandler } from './types';

export function loadHandlers(): StepHandler[] {
  const dir = __dirname;
  const handlers: StepHandler[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(ts|js)$/.test(file)) continue;
    if (['loader.ts','types.ts'].includes(file)) continue;
    const mod = require(path.join(dir, file));
    const h: StepHandler | undefined = mod.default || mod.handler;
    if (h && typeof h.run === 'function' && typeof h.match === 'function') handlers.push(h);
  }
  return handlers;
}
```

Create **codegen handler** by moving code from `runner`:
`src/worker/handlers/codegen.ts`:
```ts
import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { codegenReadme } from "../../tools/codegen";

const handler: StepHandler = {
  match: (tool) => tool === 'codegen',
  async run({ runId, step }) {
    const stepId = step.id;
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId]);
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    const artifactContent = await codegenReadme(step.inputs || {});
    const artifactName = "README.md";
    const path = `runs/${runId}/steps/${stepId}/${artifactName}`;
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).upload(path, new Blob([artifactContent]), { upsert: true } as any);
    if (error) throw error;
    await query(`insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`, [
      stepId, "text/markdown", path, JSON.stringify({ tool: step.tool })
    ]);
    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      stepId, JSON.stringify({ artifact: path })
    ]);
    await recordEvent(runId, "step.finished", { artifact: path }, stepId);
  }
};
export default handler;
```

**Replace** `src/worker/runner.ts` with a dispatcher:
```ts
import { query } from "../lib/db";
import { recordEvent } from "../lib/events";
import { log } from "../lib/logger";
import { loadHandlers } from "./handlers/loader";
import type { Step } from "./handlers/types";

const handlers = loadHandlers();

export async function runStep(runId: string, stepId: string) {
  const stepQ = await query<Step>(`select * from nofx.step where id = $1`, [stepId]);
  const step = stepQ.rows[0] as any as Step;
  if (!step) throw new Error("step not found");

  const h = handlers.find(h => h.match(step.tool));
  if (!h) {
    await recordEvent(runId, "step.failed", { error: "no handler for tool", tool: step.tool }, stepId);
    await query(`update nofx.step set status='failed', ended_at=now() where id=$1`, [stepId]);
    throw new Error("no handler for " + step.tool);
  }

  try {
    await h.run({ runId, step });
    // close run if done
    const remaining = await query<{ count: string }>(
      `select count(*)::int as count from nofx.step where run_id=$1 and status not in ('succeeded','cancelled')`, [runId]
    );
    if (Number(remaining.rows[0].count) === 0) {
      await query(`update nofx.run set status='succeeded', ended_at=now() where id=$1`, [runId]);
      await recordEvent(runId, "run.succeeded", {});
    }
  } catch (err:any) {
    log.error({ err }, "step failed");
    await query(`update nofx.step set status='failed', ended_at=now() where id=$1`, [stepId]);
    await recordEvent(runId, "step.failed", { error: err.message }, stepId);
    await query(`update nofx.run set status='failed', ended_at=now() where id=$1`, [runId]);
    await recordEvent(runId, "run.failed", { reason: "step failed", stepId });
  }
}
```

**No other files changed** in this base task.

## Done
Commit with message: `chore(base): parallel-ready refactor (router loader, queue adapters, handler plugins)`.
