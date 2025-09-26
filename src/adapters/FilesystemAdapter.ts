/**
 * Filesystem adapter for local development and testing
 * This should be extracted from the original store.ts filesystem functions
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RunRow,
  RunSummaryRow,
  StepRow,
  EventRow,
  GateRow,
  ArtifactRow,
  ArtifactWithStepName,
  OutboxRow,
  JsonValue,
  RunStatus,
  StepStatus,
  GateStatus
} from '../repositories/types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'local_data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions
const getRunDir = (runId: string): string => path.join(DATA_DIR, 'runs', runId);
const getStepFile = (runId: string, stepId: string): string =>
  path.join(getRunDir(runId), 'steps', `${stepId}.json`);
const getEventFile = (runId: string, eventId: string): string =>
  path.join(getRunDir(runId), 'events', `${eventId}.json`);
const getGateFile = (runId: string, gateId: string): string =>
  path.join(getRunDir(runId), 'gates', `${gateId}.json`);
const getArtifactFile = (runId: string, artifactId: string): string =>
  path.join(getRunDir(runId), 'artifacts', `${artifactId}.json`);

// Run operations
export async function fsGetRun(id: string): Promise<RunRow | undefined> {
  const runFile = path.join(getRunDir(id), 'run.json');
  if (!fs.existsSync(runFile)) return undefined;
  return JSON.parse(await fsp.readFile(runFile, 'utf-8'));
}

export async function fsUpdateRun(run: RunRow): Promise<void> {
  const runDir = getRunDir(run.id);
  await fsp.mkdir(runDir, { recursive: true });
  await fsp.writeFile(
    path.join(runDir, 'run.json'),
    JSON.stringify(run, null, 2)
  );
}

export async function fsListRuns(limit: number = 50, projectId?: string): Promise<RunSummaryRow[]> {
  const runsDir = path.join(DATA_DIR, 'runs');
  if (!fs.existsSync(runsDir)) return [];

  const runDirs = await fsp.readdir(runsDir);
  const runs: RunSummaryRow[] = [];

  for (const runId of runDirs) {
    const run = await fsGetRun(runId);
    if (run && (!projectId || run.project_id === projectId)) {
      runs.push({
        id: run.id,
        status: run.status,
        created_at: run.created_at,
        title: (run.plan as any)?.goal || ''
      });
    }
  }

  return runs
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function fsResetRun(runId: string): Promise<void> {
  const run = await fsGetRun(runId);
  if (run) {
    run.status = 'queued';
    run.ended_at = undefined;
    run.completed_at = undefined;
    await fsUpdateRun(run);
  }
}

// Step operations
export async function fsGetStep(id: string): Promise<StepRow | undefined> {
  const runsDir = path.join(DATA_DIR, 'runs');
  if (!fs.existsSync(runsDir)) return undefined;

  for (const runId of await fsp.readdir(runsDir)) {
    const stepFile = getStepFile(runId, id);
    if (fs.existsSync(stepFile)) {
      return JSON.parse(await fsp.readFile(stepFile, 'utf-8'));
    }
  }
  return undefined;
}

export async function fsFindStepByIdempotencyKey(
  runId: string,
  key: string
): Promise<StepRow | undefined> {
  const stepsDir = path.join(getRunDir(runId), 'steps');
  if (!fs.existsSync(stepsDir)) return undefined;

  for (const stepFile of await fsp.readdir(stepsDir)) {
    const step = JSON.parse(
      await fsp.readFile(path.join(stepsDir, stepFile), 'utf-8')
    );
    if (step.idempotency_key === key) return step;
  }
  return undefined;
}

export async function fsUpdateStep(step: StepRow): Promise<void> {
  const stepDir = path.join(getRunDir(step.run_id), 'steps');
  await fsp.mkdir(stepDir, { recursive: true });
  await fsp.writeFile(
    getStepFile(step.run_id, step.id),
    JSON.stringify(step, null, 2)
  );
}

export async function fsListStepsByRun(runId: string): Promise<StepRow[]> {
  const stepsDir = path.join(getRunDir(runId), 'steps');
  if (!fs.existsSync(stepsDir)) return [];

  const steps: StepRow[] = [];
  for (const stepFile of await fsp.readdir(stepsDir)) {
    steps.push(
      JSON.parse(await fsp.readFile(path.join(stepsDir, stepFile), 'utf-8'))
    );
  }

  return steps.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function fsCountRemainingSteps(runId: string): Promise<number> {
  const steps = await fsListStepsByRun(runId);
  return steps.filter(
    s => s.status !== 'succeeded' && s.status !== 'cancelled'
  ).length;
}

export async function fsResetStep(stepId: string): Promise<void> {
  const step = await fsGetStep(stepId);
  if (step) {
    step.status = 'queued';
    step.started_at = undefined;
    step.ended_at = undefined;
    step.completed_at = undefined;
    step.outputs = {};
    await fsUpdateStep(step);
  }
}

// Event operations
export async function fsRecordEvent(
  runId: string,
  type: string,
  payload: JsonValue,
  stepId?: string
): Promise<void> {
  const eventId = randomUUID();
  const eventDir = path.join(getRunDir(runId), 'events');
  await fsp.mkdir(eventDir, { recursive: true });

  const event: EventRow = {
    id: eventId,
    run_id: runId,
    step_id: stepId,
    type,
    payload,
    created_at: new Date().toISOString()
  };

  await fsp.writeFile(
    getEventFile(runId, eventId),
    JSON.stringify(event, null, 2)
  );
}

export async function fsListEvents(runId: string): Promise<EventRow[]> {
  const eventsDir = path.join(getRunDir(runId), 'events');
  if (!fs.existsSync(eventsDir)) return [];

  const events: EventRow[] = [];
  for (const eventFile of await fsp.readdir(eventsDir)) {
    events.push(
      JSON.parse(await fsp.readFile(path.join(eventsDir, eventFile), 'utf-8'))
    );
  }

  return events.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Gate operations
export async function fsCreateOrGetGate(
  runId: string,
  stepId: string,
  gateType: string
): Promise<GateRow | undefined> {
  const gates = await fsListGatesByRun(runId);
  const existing = gates.find(
    g => g.step_id === stepId && g.gate_type === gateType
  );
  if (existing) return existing;

  const gateId = randomUUID();
  const gateDir = path.join(getRunDir(runId), 'gates');
  await fsp.mkdir(gateDir, { recursive: true });

  const gate: GateRow = {
    id: gateId,
    run_id: runId,
    step_id: stepId,
    gate_type: gateType,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  await fsp.writeFile(getGateFile(runId, gateId), JSON.stringify(gate, null, 2));
  return gate;
}

export async function fsGetLatestGate(
  runId: string,
  stepId: string
): Promise<GateRow | undefined> {
  const gates = await fsListGatesByRun(runId);
  const stepGates = gates
    .filter(g => g.step_id === stepId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return stepGates[0];
}

export async function fsUpdateGate(
  runId: string,
  gateId: string,
  patch: Partial<GateRow>
): Promise<void> {
  const gateFile = getGateFile(runId, gateId);
  if (fs.existsSync(gateFile)) {
    const gate = JSON.parse(await fsp.readFile(gateFile, 'utf-8'));
    Object.assign(gate, patch);
    if (patch.approved_by) {
      gate.approved_at = new Date().toISOString();
    }
    await fsp.writeFile(gateFile, JSON.stringify(gate, null, 2));
  }
}

export async function fsListGatesByRun(runId: string): Promise<GateRow[]> {
  const gatesDir = path.join(getRunDir(runId), 'gates');
  if (!fs.existsSync(gatesDir)) return [];

  const gates: GateRow[] = [];
  for (const gateFile of await fsp.readdir(gatesDir)) {
    gates.push(
      JSON.parse(await fsp.readFile(path.join(gatesDir, gateFile), 'utf-8'))
    );
  }

  return gates.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Artifact operations
export async function fsAddArtifact(
  stepId: string,
  type: string,
  pth: string,
  metadata?: JsonValue
): Promise<void> {
  const step = await fsGetStep(stepId);
  if (!step) return;

  const artifactId = randomUUID();
  const artifactDir = path.join(getRunDir(step.run_id), 'artifacts');
  await fsp.mkdir(artifactDir, { recursive: true });

  const artifact: ArtifactRow = {
    id: artifactId,
    step_id: stepId,
    type,
    path: pth,
    metadata,
    created_at: new Date().toISOString()
  };

  await fsp.writeFile(
    getArtifactFile(step.run_id, artifactId),
    JSON.stringify(artifact, null, 2)
  );
}

export async function fsListArtifactsByRun(runId: string): Promise<ArtifactWithStepName[]> {
  const artifactsDir = path.join(getRunDir(runId), 'artifacts');
  if (!fs.existsSync(artifactsDir)) return [];

  const artifacts: ArtifactWithStepName[] = [];
  const steps = await fsListStepsByRun(runId);

  for (const artifactFile of await fsp.readdir(artifactsDir)) {
    const artifact = JSON.parse(
      await fsp.readFile(path.join(artifactsDir, artifactFile), 'utf-8')
    );
    const step = steps.find(s => s.id === artifact.step_id);
    artifacts.push({
      ...artifact,
      step_name: step?.name || 'unknown'
    });
  }

  return artifacts.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Inbox operations
const inboxDir = path.join(DATA_DIR, 'inbox');
if (!fs.existsSync(inboxDir)) {
  fs.mkdirSync(inboxDir, { recursive: true });
}

export async function fsInboxMarkIfNew(key: string): Promise<boolean> {
  const keyFile = path.join(inboxDir, `${key}.lock`);
  if (fs.existsSync(keyFile)) return false;
  await fsp.writeFile(keyFile, new Date().toISOString());
  return true;
}

export async function fsInboxDelete(key: string): Promise<void> {
  const keyFile = path.join(inboxDir, `${key}.lock`);
  if (fs.existsSync(keyFile)) {
    await fsp.unlink(keyFile);
  }
}

// Outbox operations
const outboxDir = path.join(DATA_DIR, 'outbox');
if (!fs.existsSync(outboxDir)) {
  fs.mkdirSync(outboxDir, { recursive: true });
}

export async function fsOutboxAdd(topic: string, payload: JsonValue): Promise<void> {
  const id = randomUUID();
  const message: OutboxRow = {
    id,
    topic,
    payload,
    sent: false,
    created_at: new Date().toISOString()
  };

  await fsp.writeFile(
    path.join(outboxDir, `${id}.json`),
    JSON.stringify(message, null, 2)
  );
}

export async function fsOutboxListUnsent(limit: number = 50): Promise<OutboxRow[]> {
  if (!fs.existsSync(outboxDir)) return [];

  const messages: OutboxRow[] = [];
  for (const msgFile of await fsp.readdir(outboxDir)) {
    const msg = JSON.parse(
      await fsp.readFile(path.join(outboxDir, msgFile), 'utf-8')
    );
    if (!msg.sent) messages.push(msg);
  }

  return messages
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export async function fsOutboxMarkSent(id: string): Promise<void> {
  const msgFile = path.join(outboxDir, `${id}.json`);
  if (fs.existsSync(msgFile)) {
    const msg = JSON.parse(await fsp.readFile(msgFile, 'utf-8'));
    msg.sent = true;
    msg.sent_at = new Date().toISOString();
    await fsp.writeFile(msgFile, JSON.stringify(msg, null, 2));
  }
}