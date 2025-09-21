import crypto from 'node:crypto';
import type { ResponsesArchive, DelegationRecord } from '../../shared/responses/archive';

type FunctionCallEvent = {
  type: 'response.function_call_arguments.done';
  call_id?: string;
  item_id?: string;
  name?: string;
  function?: { name?: string };
  arguments?: unknown;
};

type ToolCompletionEvent = {
  type: 'response.output_item.done';
  item?: {
    id?: string;
    type?: string;
    status?: string;
    output?: unknown;
    name?: string;
  };
};

type DelegationEvent = FunctionCallEvent | ToolCompletionEvent | { type: string; [key: string]: unknown };

export class DelegationTracker {
  private readonly archive: ResponsesArchive;

  private readonly cache = new Map<string, Map<string, DelegationRecord>>();

  constructor(options: { archive: ResponsesArchive }) {
    this.archive = options.archive;
  }

  handleEvent(runId: string, event: DelegationEvent): void {
    switch (event.type) {
      case 'response.function_call_arguments.done':
        this.recordFunctionCall(runId, event as FunctionCallEvent);
        break;
      case 'response.output_item.done':
        this.recordCompletion(runId, event as ToolCompletionEvent);
        break;
      default:
        break;
    }
  }

  getDelegations(runId: string): DelegationRecord[] {
    const runMaybe = this.archive.getRun(runId);
    const run = isPromise(runMaybe) ? undefined : runMaybe;
    if (run?.delegations) {
      return run.delegations.map(cloneDelegation);
    }
    const cached = this.cache.get(runId);
    if (!cached) return [];
    return Array.from(cached.values()).map(cloneDelegation);
  }

  private recordFunctionCall(runId: string, event: FunctionCallEvent) {
    const callId = this.resolveCallId(event);
    const toolName = this.resolveToolName(event);
    const args = this.parseArguments(event.arguments);
    const record: DelegationRecord = {
      callId,
      toolName,
      requestedAt: new Date(),
      status: 'requested',
      arguments: args,
    };
    this.cacheDelegation(runId, record);
    if (typeof this.archive.recordDelegation === 'function') {
      this.archive.recordDelegation(runId, record);
    }
  }

  private recordCompletion(runId: string, event: ToolCompletionEvent) {
    const item = event.item;
    if (!item || item.type !== 'tool_call') return;
    const callId = item.id ?? this.resolveToolName({ name: item.name } as FunctionCallEvent);
    const status = item.status === 'failed' ? 'failed' : 'completed';
    const updates: Partial<DelegationRecord> = {
      status,
      completedAt: new Date(),
      output: item.output,
    };
    const cache = this.cache.get(runId);
    const existing = cache?.get(callId);
    if (existing) {
      const merged = { ...existing, ...updates };
      this.cacheDelegation(runId, merged);
    }
    if (typeof this.archive.updateDelegation === 'function') {
      try {
        this.archive.updateDelegation(runId, callId, updates);
      } catch (err) {
        if (!existing && typeof this.archive.recordDelegation === 'function') {
          const seed: DelegationRecord = {
            callId,
            toolName: item.name ?? 'unknown_tool',
            requestedAt: new Date(),
            status,
            completedAt: updates.completedAt,
            output: updates.output,
          };
          this.archive.recordDelegation(runId, seed);
          this.cacheDelegation(runId, seed);
        }
      }
    }
  }

  private cacheDelegation(runId: string, record: DelegationRecord) {
    const bucket = this.cache.get(runId) ?? new Map<string, DelegationRecord>();
    bucket.set(record.callId, { ...record });
    this.cache.set(runId, bucket);
  }

  private resolveCallId(event: FunctionCallEvent): string {
    if (event.call_id && typeof event.call_id === 'string') return event.call_id;
    if (event.item_id && typeof event.item_id === 'string') return event.item_id;
    return `call_${crypto.randomUUID()}`;
  }

  private resolveToolName(event: FunctionCallEvent): string {
    if (typeof event.name === 'string' && event.name.length) return event.name;
    if (event.function && typeof event.function.name === 'string' && event.function.name.length) {
      return event.function.name;
    }
    return 'unknown_tool';
  }

  private parseArguments(payload: unknown): unknown {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  }
}

function cloneDelegation(record: DelegationRecord): DelegationRecord {
  return {
    ...record,
    requestedAt: new Date(record.requestedAt),
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
  };
}

function isPromise<T>(input: T | Promise<T>): input is Promise<T> {
  return Boolean(input && typeof (input as Promise<T>).then === 'function');
}
