import { log } from './logger';
import { getTraceStatusSync, refreshTraceStatus } from './traceConfig';

type TracePayload = Record<string, unknown> | undefined;

let primed = false;

function ensurePrimed() {
  if (primed) return;
  primed = true;
  refreshTraceStatus().catch(() => {
    // ignore failures; tracing will simply remain disabled until next refresh
  });
}

function traceEnabled(): boolean {
  ensurePrimed();
  const status = getTraceStatusSync();
  return status.value;
}

export function trace(event: string, payload?: TracePayload) {
  if (!traceEnabled()) return;
  const meta = payload ? { ...payload } : {};
  log.info({ trace: true, event, ...meta }, `[trace] ${event}`);
}

export function traceDebug(event: string, payload?: TracePayload) {
  if (!traceEnabled()) return;
  const meta = payload ? { ...payload } : {};
  log.debug({ trace: true, event, ...meta }, `[trace] ${event}`);
}
