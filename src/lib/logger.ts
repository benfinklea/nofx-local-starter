import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { getContext } from "./observability";

const baseOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      'authorization', 'token', 'secret', 'password', 'apiKey', 'apikey',
      '*.authorization', '*.token', '*.secret', '*.password', '*.apiKey', '*.apikey',
      'headers.authorization', 'req.headers.authorization'
    ],
    censor: '***'
  },
  mixin() {
    const ctx = getContext();
    return ctx ? { requestId: ctx.requestId, runId: ctx.runId, stepId: ctx.stepId, provider: ctx.provider, retryCount: ctx.retryCount, projectId: ctx.projectId } : {};
  }
};

function configureStreams() {
  // Always log to stdout
  const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

  if ((process.env.LOG_FILE_ENABLED || '').toLowerCase() === 'true') {
    const logDir = process.env.LOG_FILE_DIR || path.join(process.cwd(), 'local_data', 'logs');
    const logFile = process.env.LOG_FILE_PATH || path.join(logDir, 'nofx-trace.log');

    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
    } catch (error) {
      // eslint-disable-next-line no-console -- we fall back to stdout if file logging fails
      console.error('[logger] Failed to create log directory', { logFile, error });
    }

    const destination = pino.destination({ dest: logFile, mkdir: true, append: true, sync: false });
    streams.push({ stream: destination });
  }

  if (streams.length > 1) {
    return pino.multistream(streams);
  }

  return undefined;
}

const configuredStreams = configureStreams();

export const log = configuredStreams ? pino(baseOptions, configuredStreams) : pino(baseOptions);
