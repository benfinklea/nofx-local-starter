import crypto from 'node:crypto';
import { store, type StepRow } from './store';
import { recordEvent } from './events';
import { runAtomically } from './tx';
import { enqueue, STEP_READY_TOPIC } from './queue';

function computeNaturalIdempotencyKey(runId: string, step: StepRow | undefined): string | null {
  if (!step) return null;
  const inputs = step.inputs || {};
  const hash = crypto.createHash('sha256').update(JSON.stringify(inputs || {})).digest('hex').slice(0, 12);
  return `${runId}:${step.name}:${hash}`;
}

export class StepNotFoundError extends Error {
  constructor() {
    super('step_not_found');
  }
}

export class StepNotRetryableError extends Error {
  constructor(status: string) {
    super(`step_not_retryable:${status}`);
  }
}

export async function retryStep(runId: string, stepId: string) {
  const step = await store.getStep(stepId) as StepRow | undefined;
  if (!step || String(step.run_id) !== runId) {
    throw new StepNotFoundError();
  }

  const status = String(step.status || '').toLowerCase();
  if (!['failed', 'timed_out', 'cancelled'].includes(status)) {
    throw new StepNotRetryableError(status);
  }

  await runAtomically(async () => {
    await store.resetStep(stepId);
    await store.resetRun(runId);
    await store.inboxDelete(`step-exec:${stepId}`);
    const naturalKey = computeNaturalIdempotencyKey(runId, step);
    if (naturalKey) await store.inboxDelete(naturalKey);
    await recordEvent(runId, 'step.retry', { stepId, previousStatus: status }, stepId);
    await recordEvent(runId, 'run.resumed', { stepId });
  });

  await enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 1 });
}
