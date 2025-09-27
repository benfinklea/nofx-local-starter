/**
 * Runtime Retry Service - extracted from runtime.ts
 * Handles retry functionality for response runs
 */

import type { RuntimeBundle } from '../runtime';
import type { ResponsesRunConfig, ResponsesRunResult } from '../runService';

export class RuntimeRetryService {
  constructor(private runtime: RuntimeBundle) {}

  async retryResponsesRun(
    originalRunId: string,
    options?: {
      tenantId?: string;
      metadata?: Record<string, string>;
      background?: boolean;
    }
  ): Promise<ResponsesRunResult> {
    const original = this.runtime.archive.getRun(originalRunId);
    if (!original) {
      throw new Error('run not found');
    }

    const tenantId = options?.tenantId ?? original.metadata?.tenant_id ?? original.metadata?.tenantId ?? 'default';
    const retryMetadata: Record<string, string> = {
      ...(original.metadata ?? {}),
      ...(options?.metadata ?? {}),
      retried_from: originalRunId,
    };

    const input = original.request.input;
    if (input === undefined) {
      throw new Error('original run is missing input payload');
    }

    const request: ResponsesRunConfig['request'] = {
      ...original.request,
      input,
      metadata: {
        ...(original.request.metadata ?? {}),
        retried_from: originalRunId,
      },
    };

    const result = await this.runtime.service.execute({
      tenantId,
      request,
      metadata: retryMetadata,
      history: undefined,
      conversationPolicy: { strategy: 'stateless' },
      background: options?.background ?? false,
    });

    // Resolve related incidents
    this.runtime.incidents.resolveIncidentsByRun(originalRunId, {
      resolvedBy: 'system',
      disposition: 'retry',
      linkedRunId: result.runId,
    });

    return result;
  }
}