/**
 * Serialization Service - extracted from archiveStore.ts
 * Handles conversion between runtime objects and file storage formats
 */

import type {
  RunRecord,
  EventRecord,
  SafetySnapshot,
  ModeratorNote,
  DelegationRecord,
} from '../../../shared/responses/archive';

export type SerializableRun = Omit<RunRecord, 'createdAt' | 'updatedAt' | 'safety' | 'delegations'> & {
  createdAt: string;
  updatedAt: string;
  safety?: SerializableSafety;
  delegations?: SerializableDelegation[];
};

export type SerializableEvent = Omit<EventRecord, 'occurredAt'> & { occurredAt: string };

export type SerializableSafety = Omit<SafetySnapshot, 'lastRefusalAt' | 'moderatorNotes'> & {
  lastRefusalAt?: string;
  moderatorNotes: SerializableModeratorNote[];
};

export type SerializableModeratorNote = Omit<ModeratorNote, 'recordedAt'> & { recordedAt: string };

export type SerializableDelegation = Omit<DelegationRecord, 'requestedAt' | 'completedAt'> & {
  requestedAt: string;
  completedAt?: string;
};

export class SerializationService {
  serializeModeratorNote(note: ModeratorNote): SerializableModeratorNote {
    return {
      ...note,
      recordedAt: note.recordedAt.toISOString(),
    };
  }

  deserializeModeratorNote(note: SerializableModeratorNote): ModeratorNote {
    return {
      ...note,
      recordedAt: new Date(note.recordedAt),
    };
  }

  serializeDelegation(record: DelegationRecord): SerializableDelegation {
    return {
      ...record,
      requestedAt: record.requestedAt.toISOString(),
      completedAt: record.completedAt ? record.completedAt.toISOString() : undefined,
    };
  }

  deserializeDelegation(record: SerializableDelegation): DelegationRecord {
    return {
      ...record,
      requestedAt: new Date(record.requestedAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
    };
  }

  serializeSafety(safety?: SafetySnapshot): SerializableSafety | undefined {
    if (!safety) return undefined;
    return {
      hashedIdentifier: safety.hashedIdentifier,
      refusalCount: safety.refusalCount,
      lastRefusalAt: safety.lastRefusalAt ? safety.lastRefusalAt.toISOString() : undefined,
      moderatorNotes: safety.moderatorNotes.map((note) => this.serializeModeratorNote(note)),
    };
  }

  deserializeSafety(safety?: SerializableSafety): SafetySnapshot | undefined {
    if (!safety) return undefined;
    return {
      hashedIdentifier: safety.hashedIdentifier,
      refusalCount: safety.refusalCount,
      lastRefusalAt: safety.lastRefusalAt ? new Date(safety.lastRefusalAt) : undefined,
      moderatorNotes: safety.moderatorNotes.map((note) => this.deserializeModeratorNote(note)),
    };
  }

  serializeRun(record: RunRecord): SerializableRun {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      safety: this.serializeSafety(record.safety),
      delegations: record.delegations ? record.delegations.map((d) => this.serializeDelegation(d)) : undefined,
    };
  }

  deserializeRun(record: SerializableRun): RunRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      safety: this.deserializeSafety(record.safety),
      delegations: record.delegations ? record.delegations.map((d) => this.deserializeDelegation(d)) : undefined,
    };
  }

  serializeEvent(record: EventRecord): SerializableEvent {
    return {
      ...record,
      occurredAt: record.occurredAt.toISOString(),
    };
  }

  deserializeEvent(record: SerializableEvent): EventRecord {
    return {
      ...record,
      occurredAt: new Date(record.occurredAt),
    };
  }
}