import pino from "pino";
import { getContext } from "./observability";

export const log = pino({
  level: process.env.LOG_LEVEL || "info",
  // Attach async context (requestId/runId/stepId/provider/retryCount) to every log line
  // without requiring call sites to pass it explicitly.
  // pino's mixin runs for each log call.
  mixin() {
    const ctx = getContext();
    return ctx ? { requestId: ctx.requestId, runId: ctx.runId, stepId: ctx.stepId, provider: ctx.provider, retryCount: ctx.retryCount } : {};
  }
});
