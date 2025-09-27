/**
 * Tracing Service - extracted from runCoordinator.ts
 * Handles OpenTelemetry tracing and span management
 */

import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';
import type { ResponsesRequest } from '../../../shared/openai/responsesSchemas';

interface StartRunTraceOptions {
  runId: string;
  tenantId: string;
}

export class TracingService {
  private readonly spans = new Map<string, Span>();
  private readonly tracer = trace.getTracer('responses.runCoordinator');

  startTracingSpan(options: StartRunTraceOptions, request: ResponsesRequest): Span {
    const span = this.tracer.startSpan('responses.run', {
      attributes: {
        'responses.run_id': options.runId,
        'responses.tenant_id': options.tenantId,
        'responses.model': request.model,
        'responses.store_flag': request.store ?? false,
        'responses.conversation_id': request.conversation && typeof request.conversation === 'string' ? request.conversation : undefined,
      },
    });
    this.spans.set(options.runId, span);
    return span;
  }

  recordTracingEvent(runId: string, name: string, attributes: Record<string, unknown> = {}) {
    const span = this.spans.get(runId);
    if (!span) return;
    const filtered: Attributes = Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => value !== undefined),
    ) as Attributes;
    span.addEvent(name, filtered);
  }

  finalizeSpan(runId: string, status: string, payload?: unknown) {
    const span = this.spans.get(runId);
    if (!span) return;
    if (status === 'response.failed' || status === 'error') {
      span.setStatus({ code: SpanStatusCode.ERROR, message: typeof payload === 'object' ? JSON.stringify(payload) : undefined });
    } else {
      span.setStatus({ code: SpanStatusCode.UNSET });
    }
    this.spans.delete(runId);
    span.end();
  }

  getSpanTraceId(runId: string): string | undefined {
    const span = this.spans.get(runId);
    return span?.spanContext().traceId;
  }
}