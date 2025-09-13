import dotenv from "dotenv";
dotenv.config();
import { subscribe, STEP_READY_TOPIC } from "../lib/queue";
import { runStep } from "./runner";
import { log } from "../lib/logger";
import fs from 'node:fs';
import path from 'node:path';

subscribe(STEP_READY_TOPIC, async ({ runId, stepId }) => {
  log.info({ runId, stepId }, "worker handling step");
  await runStep(runId, stepId);
});

log.info("Worker up");

// Dev-only restart watcher to exit when flag changes
if (process.env.DEV_RESTART_WATCH === '1') {
  const flagPath = path.join(process.cwd(), '.dev-restart');
  let last = 0;
  setInterval(() => {
    try {
      const stat = fs.statSync(flagPath);
      const m = stat.mtimeMs;
      if (m > last) { last = m; log.info('Dev restart flag changed; exiting worker'); process.exit(0); }
    } catch {}
  }, 1500);
}
