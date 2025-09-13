import dotenv from "dotenv";
dotenv.config();
import { subscribe, STEP_READY_TOPIC } from "../lib/queue";
import { runStep } from "./runner";
import { log } from "../lib/logger";

subscribe(STEP_READY_TOPIC, async ({ runId, stepId }) => {
  log.info({ runId, stepId }, "worker handling step");
  await runStep(runId, stepId);
});

log.info("Worker up");
