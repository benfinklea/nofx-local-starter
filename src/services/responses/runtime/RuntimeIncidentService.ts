/**
 * Runtime Incident Service - extracted from runtime.ts
 * Handles incident management operations
 */

import type { RuntimeBundle } from '../runtime';
import type { IncidentRecord, IncidentStatus, IncidentDisposition } from '../incidentLog';

export interface SerializedIncident {
  id: string;
  runId: string;
  status: string;
  type: string;
  sequence: number;
  occurredAt: string;
  tenantId?: string;
  model?: string;
  requestId?: string;
  traceId?: string;
  reason?: string;
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    notes?: string;
    disposition: string;
    linkedRunId?: string;
  };
}

export class RuntimeIncidentService {
  constructor(private runtime: RuntimeBundle) {}

  listResponseIncidents(status: IncidentStatus = 'open'): SerializedIncident[] {
    return this.runtime.incidents.listIncidents({ status }).map(this.serializeIncident);
  }

  resolveResponseIncident(input: {
    incidentId: string;
    resolvedBy: string;
    notes?: string;
    disposition?: string;
    linkedRunId?: string;
  }): SerializedIncident {
    const record = this.runtime.incidents.resolveIncident({
      incidentId: input.incidentId,
      resolvedBy: input.resolvedBy,
      notes: input.notes,
      disposition: (input.disposition as IncidentDisposition | undefined) ?? 'manual',
      linkedRunId: input.linkedRunId,
    });
    return this.serializeIncident(record);
  }

  getRunIncidents(runId: string): SerializedIncident[] {
    return this.runtime.incidents.getIncidentsForRun(runId).map(this.serializeIncident);
  }

  private serializeIncident(record: IncidentRecord): SerializedIncident {
    return {
      id: record.id,
      runId: record.runId,
      status: record.status,
      type: record.type,
      sequence: record.sequence,
      occurredAt: record.occurredAt.toISOString(),
      tenantId: record.tenantId,
      model: record.model,
      requestId: record.requestId,
      traceId: record.traceId,
      reason: record.reason,
      resolution: record.resolution
        ? {
            resolvedAt: record.resolution.resolvedAt.toISOString(),
            resolvedBy: record.resolution.resolvedBy,
            notes: record.resolution.notes,
            disposition: record.resolution.disposition,
            linkedRunId: record.resolution.linkedRunId,
          }
        : undefined,
    };
  }
}