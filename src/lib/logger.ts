import pino from "pino";
import { getContext } from "./observability";

export const log = pino({
  level: process.env.LOG_LEVEL || "info",
  // Redact common sensitive fields in logged objects
  redact: {
    paths: [
      'authorization', 'token', 'secret', 'password', 'apiKey', 'apikey',
      '*.authorization', '*.token', '*.secret', '*.password', '*.apiKey', '*.apikey',
      'headers.authorization', 'req.headers.authorization'
    ],
    censor: '***'
  },
  // Attach async context (requestId/runId/stepId/provider/retryCount) to every log line
  // without requiring call sites to pass it explicitly.
  // pino's mixin runs for each log call.
  mixin() {
    const ctx = getContext();
    return ctx ? { requestId: ctx.requestId, runId: ctx.runId, stepId: ctx.stepId, provider: ctx.provider, retryCount: ctx.retryCount, projectId: ctx.projectId } : {};
  }
});
