/**
 * Event Processing Service - extracted from runCoordinator.ts
 * Handles event processing, safety hooks, and incident management
 */

import type { ResponsesArchive, RunRecord } from '../../../shared/responses/archive';
import type { IncidentLog } from '../incidentLog';
import type { DelegationTracker } from '../delegationTracker';
import type { RateLimitTracker } from '../rateLimitTracker';
import { TracingService } from './TracingService';

export class EventProcessingService {
  constructor(
    private readonly archive: ResponsesArchive,
    private readonly tracingService: TracingService,
    private readonly incidentLog?: IncidentLog,
    private readonly delegationTracker?: DelegationTracker,
    private readonly rateLimitTracker?: RateLimitTracker,
  ) {}

  processEvent(runId: string, event: { type: string; sequence_number?: number; [key: string]: unknown }): void {
    this.tracingService.recordTracingEvent(runId, event.type, { sequence: event.sequence_number ?? event.sequenceNumber });
    this.processSafetyHooks(runId, event);
    this.processIncidentHooks(runId, event);
    this.delegationTracker?.handleEvent(runId, event as any);

    if (this.isTerminalEvent(event.type)) {
      const status = event.type === 'response.failed' ? 'error' : event.type;
      this.tracingService.finalizeSpan(runId, status, event);
    }
  }

  private processSafetyHooks(runId: string, event: { type: string }): void {
    if (event.type === 'response.refusal.done') {
      this.archive.updateSafety?.(runId, { refusalLoggedAt: new Date() });
      this.tracingService.recordTracingEvent(runId, 'responses.refusal.recorded');
    }
  }

  private processIncidentHooks(runId: string, event: { type: string; sequence_number?: number; [key: string]: unknown }): void {
    if (!this.incidentLog) return;

    if (event.type === 'response.failed' || event.type === 'response.incomplete') {
      const runCandidate = this.archive.getRun?.(runId);
      const run: RunRecord | undefined = runCandidate instanceof Promise ? undefined : runCandidate;
      const tenantId = run?.metadata?.tenant_id ?? run?.metadata?.tenantId;
      const lastRate = tenantId ? this.rateLimitTracker?.getLastSnapshot(tenantId) : this.rateLimitTracker?.getLastSnapshot();

      this.incidentLog.recordIncident({
        runId,
        type: event.type === 'response.failed' ? 'failed' : 'incomplete',
        sequence: (event.sequence_number ?? event.sequenceNumber ?? 0) as number,
        occurredAt: new Date(),
        tenantId,
        model: run?.request?.model,
        requestId: lastRate?.requestId,
        traceId: run?.traceId,
        reason: JSON.stringify(event),
      });
      this.tracingService.recordTracingEvent(runId, 'responses.incident.recorded');
    }

    if (event.type === 'response.completed') {
      this.incidentLog.resolveIncidentsByRun(runId, {
        resolvedBy: 'system',
        disposition: 'manual',
        linkedRunId: runId,
      });
    }
  }

  private isTerminalEvent(type: string): boolean {
    return type === 'response.completed' || type === 'response.failed' || type === 'response.cancelled' || type === 'response.incomplete';
  }
}