// Lightweight facade around prom-client with graceful fallback when missing.
// This lets the app run even before dependencies are installed.
type LabelValues = Record<string, string>;

type HistogramLike = { observe(labels: LabelValues, value: number): void };
type CounterLike = { inc(labels?: LabelValues, value?: number): void };
type GaugeLike = { set(labels: LabelValues, value: number): void };

type MetricsApi = {
  httpRequestDuration: HistogramLike;
  stepDuration: HistogramLike;
  dbQueryDuration: HistogramLike;
  stepsTotal: CounterLike; // labels: status
  retriesTotal: CounterLike; // labels: provider
  queueDepth: GaugeLike; // labels: topic, state
  dlqSize: GaugeLike; // labels: topic
  queueOldestAgeMs: GaugeLike; // labels: topic
  registryOperationDuration: HistogramLike; // labels: entity, action
  render(): Promise<string>;
};

function makeNoop(): MetricsApi {
  const h: HistogramLike = { observe: () => {} };
  const c: CounterLike = { inc: () => {} };
  const g: GaugeLike = { set: () => {} };
  return {
    httpRequestDuration: h,
    stepDuration: h,
    dbQueryDuration: h,
    stepsTotal: c,
    retriesTotal: c,
    queueDepth: g,
    dlqSize: g,
    queueOldestAgeMs: g,
    registryOperationDuration: h,
    async render() { return '# metrics unavailable: prom-client not installed\n'; }
  };
}

let impl: MetricsApi = makeNoop();

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const client = require('prom-client');
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in ms',
    buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200],
    labelNames: ['method','route','status']
  });
  const stepDuration = new client.Histogram({
    name: 'step_duration_ms',
    help: 'Workflow step duration in ms',
    buckets: [10, 50, 100, 200, 500, 1000, 3000, 10000],
    labelNames: ['tool','status']
  });
  const dbQueryDuration = new client.Histogram({
    name: 'db_query_duration_ms',
    help: 'DB query duration in ms',
    buckets: [1, 3, 5, 10, 20, 50, 100, 250, 500, 1000],
    labelNames: ['op']
  });
  const stepsTotal = new client.Counter({
    name: 'steps_total',
    help: 'Count of steps by status',
    labelNames: ['status']
  });
  const retriesTotal = new client.Counter({
    name: 'retries_total',
    help: 'Count of retries by provider',
    labelNames: ['provider']
  });
  const queueDepth = new client.Gauge({
    name: 'queue_depth',
    help: 'Queue counts by state',
    labelNames: ['topic','state']
  });
  const dlqSize = new client.Gauge({
    name: 'dlq_size',
    help: 'Dead-letter queue size',
    labelNames: ['topic']
  });
  const queueOldestAgeMs = new client.Gauge({
    name: 'queue_oldest_age_ms',
    help: 'Oldest waiting job age in milliseconds',
    labelNames: ['topic']
  });
  const registryOperationDuration = new client.Histogram({
    name: 'registry_operation_duration_ms',
    help: 'Registry operation duration in ms',
    buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600],
    labelNames: ['entity','action']
  });

  register.registerMetric(httpRequestDuration);
  register.registerMetric(stepDuration);
  register.registerMetric(dbQueryDuration);
  register.registerMetric(stepsTotal);
  register.registerMetric(retriesTotal);
  register.registerMetric(queueDepth);
  register.registerMetric(dlqSize);
  register.registerMetric(queueOldestAgeMs);
  register.registerMetric(registryOperationDuration);

  impl = {
    httpRequestDuration,
    stepDuration,
    dbQueryDuration,
    stepsTotal,
    retriesTotal,
    queueDepth,
    dlqSize,
    queueOldestAgeMs,
    registryOperationDuration,
    async render() { return await register.metrics(); }
  } as MetricsApi;
} catch {
  // prom-client not installed; keep noop
}

export const metrics = impl;
