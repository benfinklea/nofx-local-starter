import dotenv from 'dotenv';
dotenv.config();
// Force memory queue in simple mode unless explicitly overridden
if (!process.env.QUEUE_DRIVER) process.env.QUEUE_DRIVER = 'memory';

import './api/main'; // importing starts the API listener
import { subscribe, STEP_READY_TOPIC } from './lib/queue';
import { runStep } from './worker/runner';
import { log } from './lib/logger';

// Attach the worker in-process
subscribe(STEP_READY_TOPIC, async ({ runId, stepId }) => {
  log.info({ runId, stepId }, 'simple.worker handling step');
  await runStep(runId, stepId);
});

log.info('Simple mode boot complete');
