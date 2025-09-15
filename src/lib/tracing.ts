import { log } from './logger';

let initialized = false;
let sdkRef: any = null;
let serviceRef = 'nofx-local';

export async function initTracing(serviceName: string) {
  if (initialized) return;
  if (process.env.OTEL_ENABLED !== '1') {
    return; // disabled by env
  }
  await enableTracing(serviceName);
}

export async function enableTracing(serviceName?: string) {
  if (initialized) return;
  try {
    // Dynamic imports keep runtime optional when not installed
    const { NodeSDK } = await import('@opentelemetry/sdk-node' as any);
    const { Resource } = await import('@opentelemetry/resources' as any);
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions' as any);
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http' as any);
    const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http' as any);
    const { ExpressInstrumentation } = await import('@opentelemetry/instrumentation-express' as any);
    const { IORedisInstrumentation } = await import('@opentelemetry/instrumentation-ioredis' as any);
    const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg' as any);

    const exporter = new (OTLPTraceExporter as any)({});
    serviceRef = serviceName || serviceRef;
    sdkRef = new (NodeSDK as any)({
      resource: new (Resource as any)({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceRef,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
      }),
      traceExporter: exporter,
      instrumentations: [
        new (HttpInstrumentation as any)(),
        new (ExpressInstrumentation as any)(),
        new (IORedisInstrumentation as any)(),
        new (PgInstrumentation as any)(),
      ]
    });
    await sdkRef.start();
    initialized = true;
    log.info('otel.tracing.started');
  } catch (e) {
    log.warn({ err: (e as any)?.message }, 'otel.tracing.disabled');
  }
}

export async function disableTracing() {
  if (!initialized) return;
  try {
    await sdkRef?.shutdown?.();
  } catch {}
  sdkRef = null;
  initialized = false;
  log.info('otel.tracing.stopped');
}

export function tracingStatus(){
  return { enabled: initialized, service: serviceRef };
}
