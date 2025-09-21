import fs from 'node:fs';
import path from 'node:path';

export type IncidentStatus = 'open' | 'resolved';
export type IncidentDisposition = 'retry' | 'dismissed' | 'escalated' | 'manual';

export interface IncidentResolution {
  resolvedAt: Date;
  resolvedBy: string;
  notes?: string;
  disposition: IncidentDisposition;
  linkedRunId?: string;
}

export interface IncidentRecord {
  id: string;
  runId: string;
  status: IncidentStatus;
  type: 'failed' | 'incomplete';
  sequence: number;
  occurredAt: Date;
  tenantId?: string;
  model?: string;
  requestId?: string;
  traceId?: string;
  reason?: string;
  resolution?: IncidentResolution;
}

export interface RecordIncidentInput {
  runId: string;
  type: 'failed' | 'incomplete';
  sequence: number;
  occurredAt?: Date;
  tenantId?: string;
  model?: string;
  requestId?: string;
  traceId?: string;
  reason?: string;
}

export interface ResolveIncidentInput {
  incidentId: string;
  resolvedBy: string;
  notes?: string;
  disposition?: IncidentDisposition;
  linkedRunId?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
    throw err;
  }
}

function serializeIncident(record: IncidentRecord) {
  return {
    ...record,
    occurredAt: record.occurredAt.toISOString(),
    resolution: record.resolution
      ? {
          ...record.resolution,
          resolvedAt: record.resolution.resolvedAt.toISOString(),
        }
      : undefined,
  };
}

function deserializeIncident(raw: any): IncidentRecord {
  return {
    ...raw,
    occurredAt: new Date(raw.occurredAt),
    resolution: raw.resolution
      ? {
          ...raw.resolution,
          resolvedAt: new Date(raw.resolution.resolvedAt),
        }
      : undefined,
  };
}

export class IncidentLog {
  private readonly file: string;

  constructor(baseDir = path.join(process.cwd(), 'local_data', 'responses')) {
    ensureDir(baseDir);
    this.file = path.join(baseDir, 'incidents.json');
  }

  recordIncident(input: RecordIncidentInput): IncidentRecord {
    const incidents = this.readAll();
    const existing = incidents.find((incident) => incident.runId === input.runId && incident.status === 'open');
    if (existing) {
      // update metadata if new details available
      existing.tenantId = existing.tenantId ?? input.tenantId;
      existing.model = existing.model ?? input.model;
      existing.requestId = existing.requestId ?? input.requestId;
      existing.traceId = existing.traceId ?? input.traceId;
      existing.reason = existing.reason ?? input.reason;
      this.writeAll(incidents);
      return existing;
    }

    const incident: IncidentRecord = {
      id: `inc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      runId: input.runId,
      status: 'open',
      type: input.type,
      sequence: input.sequence,
      occurredAt: input.occurredAt ?? new Date(),
      tenantId: input.tenantId,
      model: input.model,
      requestId: input.requestId,
      traceId: input.traceId,
      reason: input.reason,
    };
    incidents.push(incident);
    this.writeAll(incidents);
    return incident;
  }

  resolveIncident(input: ResolveIncidentInput): IncidentRecord {
    const incidents = this.readAll();
    const match = incidents.find((incident) => incident.id === input.incidentId);
    if (!match) throw new Error('incident not found');
    if (match.status === 'resolved') return match;
    match.status = 'resolved';
    match.resolution = {
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy,
      notes: input.notes,
      disposition: input.disposition ?? 'manual',
      linkedRunId: input.linkedRunId,
    };
    this.writeAll(incidents);
    return match;
  }

  resolveIncidentsByRun(runId: string, resolution: Omit<ResolveIncidentInput, 'incidentId'>): void {
    const incidents = this.readAll();
    let updated = false;
    for (const incident of incidents) {
      if (incident.runId === runId && incident.status === 'open') {
        incident.status = 'resolved';
        incident.resolution = {
          resolvedAt: new Date(),
          resolvedBy: resolution.resolvedBy,
          notes: resolution.notes,
          disposition: resolution.disposition ?? 'retry',
          linkedRunId: resolution.linkedRunId,
        };
        updated = true;
      }
    }
    if (updated) this.writeAll(incidents);
  }

  listIncidents(filter?: { status?: IncidentStatus }): IncidentRecord[] {
    const incidents = this.readAll();
    if (!filter?.status) return incidents;
    return incidents.filter((incident) => incident.status === filter.status);
  }

  getIncidentsForRun(runId: string): IncidentRecord[] {
    return this.readAll().filter((incident) => incident.runId === runId);
  }

  private readAll(): IncidentRecord[] {
    const raw = readJSON<any[]>(this.file, []);
    return raw.map(deserializeIncident);
  }

  private writeAll(records: IncidentRecord[]): void {
    ensureDir(path.dirname(this.file));
    fs.writeFileSync(this.file, JSON.stringify(records.map(serializeIncident), null, 2), 'utf8');
  }
}
