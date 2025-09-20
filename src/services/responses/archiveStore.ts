import fs from 'node:fs';
import path from 'node:path';
import { validateResponsesRequest, responsesResultSchema } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import type { ResponsesArchive, RunRecord, EventRecord, TimelineSnapshot } from '../../shared/responses/archive';

type SerializableRun = Omit<RunRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializableEvent = Omit<EventRecord, 'occurredAt'> & { occurredAt: string };

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJSON(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function serializeRun(record: RunRecord): SerializableRun {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function deserializeRun(record: SerializableRun): RunRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function serializeEvent(record: EventRecord): SerializableEvent {
  return {
    ...record,
    occurredAt: record.occurredAt.toISOString(),
  };
}

function deserializeEvent(record: SerializableEvent): EventRecord {
  return {
    ...record,
    occurredAt: new Date(record.occurredAt),
  };
}

export class FileSystemResponsesArchive implements ResponsesArchive {
  private readonly baseDir: string;

  constructor(baseDir = path.join(process.cwd(), 'local_data', 'responses')) {
    this.baseDir = baseDir;
  }

  private runDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  private runFile(runId: string): string {
    return path.join(this.runDir(runId), 'run.json');
  }

  private eventsFile(runId: string): string {
    return path.join(this.runDir(runId), 'events.json');
  }

  startRun(input: { runId: string; request: ResponsesRequest | unknown; conversationId?: string; metadata?: Record<string, string> }): RunRecord {
    const dir = this.runDir(input.runId);
    if (fs.existsSync(dir)) {
      const runPath = this.runFile(input.runId);
      if (fs.existsSync(runPath)) {
        throw new Error(`run ${input.runId} already exists`);
      }
    }
    ensureDir(dir);

    const request = validateResponsesRequest(input.request);
    const now = new Date();
    const record: RunRecord = {
      runId: input.runId,
      request,
      conversationId: input.conversationId,
      metadata: input.metadata,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    writeJSON(this.runFile(input.runId), serializeRun(record));
    writeJSON(this.eventsFile(input.runId), []);

    return record;
  }

  recordEvent(runId: string, input: { sequence?: number; type: string; payload: unknown; occurredAt?: Date }): EventRecord {
    const run = this.getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);

    const eventsPath = this.eventsFile(runId);
    const events = readJSON<SerializableEvent[]>(eventsPath, []);
    const lastSequence = events.length ? events[events.length - 1].sequence : 0;
    const nextSequence = input.sequence ?? lastSequence + 1;

    if (events.some((event) => event.sequence === nextSequence)) {
      throw new Error(`sequence ${nextSequence} already recorded for run ${runId}`);
    }

    const record: EventRecord = {
      runId,
      sequence: nextSequence,
      type: input.type,
      payload: input.payload,
      occurredAt: input.occurredAt ?? new Date(),
    };

    events.push(serializeEvent(record));
    writeJSON(eventsPath, events);

    return record;
  }

  updateStatus(input: { runId: string; status: RunRecord['status']; result?: ResponsesResult | unknown }): RunRecord {
    const runPath = this.runFile(input.runId);
    if (!fs.existsSync(runPath)) throw new Error(`run ${input.runId} not found`);

    const run = deserializeRun(readJSON<SerializableRun>(runPath, null as unknown as SerializableRun));
    const parsedResult = input.result ? responsesResultSchema.parse(input.result) : undefined;
    const updated: RunRecord = {
      ...run,
      status: input.status,
      result: parsedResult ?? run.result,
      updatedAt: new Date(),
    };

    writeJSON(runPath, serializeRun(updated));
    return updated;
  }

  getRun(runId: string): RunRecord | undefined {
    const runPath = this.runFile(runId);
    if (!fs.existsSync(runPath)) return undefined;
    return deserializeRun(readJSON<SerializableRun>(runPath, null as unknown as SerializableRun));
  }

  getTimeline(runId: string): TimelineSnapshot | undefined {
    const run = this.getRun(runId);
    if (!run) return undefined;
    const events = readJSON<SerializableEvent[]>(this.eventsFile(runId), []);
    return {
      run,
      events: events.map(deserializeEvent),
    };
  }

  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined {
    const snapshot = this.getTimeline(runId);
    if (!snapshot) return undefined;
    return {
      run: snapshot.run,
      events: snapshot.events.filter((event) => event.sequence <= sequence),
    };
  }

  listRuns(): RunRecord[] {
    if (!fs.existsSync(this.baseDir)) return [];
    const entries = fs.readdirSync(this.baseDir);
    const runs: RunRecord[] = [];
    for (const entry of entries) {
      const run = this.getRun(entry);
      if (run) runs.push(run);
    }
    return runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteRun(runId: string): void {
    const dir = this.runDir(runId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  pruneOlderThan(cutoff: Date): void {
    const runs = this.listRuns();
    for (const run of runs) {
      if (run.updatedAt < cutoff) {
        this.deleteRun(run.runId);
      }
    }
  }
}
