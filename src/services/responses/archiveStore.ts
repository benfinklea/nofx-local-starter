import fs from 'node:fs';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { validateResponsesRequest, responsesResultSchema } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import type {
  ResponsesArchive,
  RunRecord,
  EventRecord,
  TimelineSnapshot,
  SafetySnapshot,
  ModeratorNote,
  ModeratorNoteInput,
} from '../../shared/responses/archive';

type SerializableRun = Omit<RunRecord, 'createdAt' | 'updatedAt' | 'safety'> & {
  createdAt: string;
  updatedAt: string;
  safety?: SerializableSafety;
};

type SerializableEvent = Omit<EventRecord, 'occurredAt'> & { occurredAt: string };

type SerializableSafety = Omit<SafetySnapshot, 'lastRefusalAt' | 'moderatorNotes'> & {
  lastRefusalAt?: string;
  moderatorNotes: SerializableModeratorNote[];
};

type SerializableModeratorNote = Omit<ModeratorNote, 'recordedAt'> & { recordedAt: string };

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

function serializeModeratorNote(note: ModeratorNote): SerializableModeratorNote {
  return {
    ...note,
    recordedAt: note.recordedAt.toISOString(),
  };
}

function deserializeModeratorNote(note: SerializableModeratorNote): ModeratorNote {
  return {
    ...note,
    recordedAt: new Date(note.recordedAt),
  };
}

function serializeSafety(safety?: SafetySnapshot): SerializableSafety | undefined {
  if (!safety) return undefined;
  return {
    hashedIdentifier: safety.hashedIdentifier,
    refusalCount: safety.refusalCount,
    lastRefusalAt: safety.lastRefusalAt ? safety.lastRefusalAt.toISOString() : undefined,
    moderatorNotes: safety.moderatorNotes.map(serializeModeratorNote),
  };
}

function deserializeSafety(safety?: SerializableSafety): SafetySnapshot | undefined {
  if (!safety) return undefined;
  return {
    hashedIdentifier: safety.hashedIdentifier,
    refusalCount: safety.refusalCount,
    lastRefusalAt: safety.lastRefusalAt ? new Date(safety.lastRefusalAt) : undefined,
    moderatorNotes: safety.moderatorNotes.map(deserializeModeratorNote),
  };
}

function serializeRun(record: RunRecord): SerializableRun {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    safety: serializeSafety(record.safety),
  };
}

function deserializeRun(record: SerializableRun): RunRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    safety: deserializeSafety(record.safety),
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

  private readonly coldStorageDir?: string;

  private readonly exportDir: string;

  constructor(baseDir = path.join(process.cwd(), 'local_data', 'responses'), opts?: { coldStorageDir?: string; exportDir?: string }) {
    this.baseDir = baseDir;
    this.coldStorageDir = opts?.coldStorageDir ?? process.env.RESPONSES_ARCHIVE_COLD_STORAGE_DIR;
    this.exportDir = opts?.exportDir ?? path.join(this.baseDir, '..', 'exports');
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

  startRun(input: {
    runId: string;
    request: ResponsesRequest | unknown;
    conversationId?: string;
    metadata?: Record<string, string>;
    traceId?: string;
    safety?: Partial<SafetySnapshot>;
  }): RunRecord {
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
      traceId: input.traceId,
      safety: input.safety
        ? {
            hashedIdentifier: input.safety.hashedIdentifier,
            refusalCount: input.safety.refusalCount ?? 0,
            lastRefusalAt: input.safety.lastRefusalAt,
            moderatorNotes: input.safety.moderatorNotes ?? [],
          }
        : undefined,
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
        if (this.coldStorageDir) {
          this.moveToColdStorage(run.runId);
        } else {
          this.deleteRun(run.runId);
        }
      }
    }
  }

  updateSafety(runId: string, input: { hashedIdentifier?: string; refusalLoggedAt?: Date }): SafetySnapshot {
    const run = this.getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    if (input.hashedIdentifier) {
      safety.hashedIdentifier = input.hashedIdentifier;
    }
    if (input.refusalLoggedAt) {
      safety.refusalCount = (safety.refusalCount ?? 0) + 1;
      safety.lastRefusalAt = input.refusalLoggedAt;
    }
    const updatedRun: RunRecord = {
      ...run,
      safety,
      updatedAt: new Date(),
    };
    writeJSON(this.runFile(runId), serializeRun(updatedRun));
    return safety;
  }

  addModeratorNote(runId: string, input: ModeratorNoteInput): ModeratorNote {
    const run = this.getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const note: ModeratorNote = {
      reviewer: input.reviewer,
      note: input.note,
      disposition: input.disposition,
      recordedAt: input.recordedAt ?? new Date(),
    };
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    safety.moderatorNotes = [...safety.moderatorNotes, note];
    const updatedRun: RunRecord = {
      ...run,
      safety,
      updatedAt: new Date(),
    };
    writeJSON(this.runFile(runId), serializeRun(updatedRun));
    return note;
  }

  async exportRun(runId: string): Promise<string> {
    const timeline = this.getTimeline(runId);
    if (!timeline) {
      throw new Error(`run ${runId} not found`);
    }
    ensureDir(this.exportDir);
    const dest = path.join(this.exportDir, `${runId}.json.gz`);
    const tmp = path.join(this.exportDir, `${runId}.${Date.now()}.json`);
    await fsPromises.writeFile(tmp, JSON.stringify({
      run: serializeRun(timeline.run),
      events: timeline.events.map(serializeEvent),
    }, null, 2));
    await pipeline(fs.createReadStream(tmp), zlib.createGzip(), fs.createWriteStream(dest));
    await fsPromises.rm(tmp);
    return dest;
  }

  private moveToColdStorage(runId: string) {
    if (!this.coldStorageDir) return;
    const sourceDir = this.runDir(runId);
    if (!fs.existsSync(sourceDir)) return;
    const destinationRoot = path.resolve(this.coldStorageDir);
    ensureDir(destinationRoot);
    const destination = path.join(destinationRoot, runId);
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(sourceDir, destination, { recursive: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}
