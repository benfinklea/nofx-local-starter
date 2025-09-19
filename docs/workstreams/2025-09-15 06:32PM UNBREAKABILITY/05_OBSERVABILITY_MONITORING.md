# 📊 WORKSTREAM 5: OBSERVABILITY & MONITORING

## Mission
Implement comprehensive observability with metrics, logging, tracing, and health checks to ensure complete visibility into system behavior and rapid issue detection.

## 🎯 Objectives
- Add 25+ observability tests
- Test metrics collection accuracy
- Validate distributed tracing
- Implement health check monitoring
- Test alerting thresholds

## 📁 Files to Create

### 1. `tests/unit/observability/metrics-collection.test.ts`

```typescript
/**
 * Metrics Collection & Accuracy Tests
 */

describe('Metrics Collection', () => {
  describe('Counter metrics', () => {
    test('accurately tracks request counts', () => {
      class MetricsCollector {
        private counters = new Map<string, number>();
        private gauges = new Map<string, number>();
        private histograms = new Map<string, number[]>();

        increment(name: string, value = 1, tags?: Record<string, string>) {
          const key = this.buildKey(name, tags);
          const current = this.counters.get(key) || 0;
          this.counters.set(key, current + value);
        }

        gauge(name: string, value: number, tags?: Record<string, string>) {
          const key = this.buildKey(name, tags);
          this.gauges.set(key, value);
        }

        histogram(name: string, value: number, tags?: Record<string, string>) {
          const key = this.buildKey(name, tags);
          const values = this.histograms.get(key) || [];
          values.push(value);
          this.histograms.set(key, values);
        }

        private buildKey(name: string, tags?: Record<string, string>): string {
          if (!tags) return name;
          const tagStr = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(',');
          return `${name}{${tagStr}}`;
        }

        getCounter(name: string, tags?: Record<string, string>): number {
          return this.counters.get(this.buildKey(name, tags)) || 0;
        }

        getHistogramStats(name: string, tags?: Record<string, string>) {
          const values = this.histograms.get(this.buildKey(name, tags)) || [];
          if (values.length === 0) return null;

          const sorted = [...values].sort((a, b) => a - b);
          return {
            count: values.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
          };
        }
      }

      const metrics = new MetricsCollector();

      // Track requests
      for (let i = 0; i < 100; i++) {
        metrics.increment('http.requests', 1, { method: 'GET', status: '200' });
        metrics.histogram('http.duration', Math.random() * 100, { method: 'GET' });
      }

      for (let i = 0; i < 20; i++) {
        metrics.increment('http.requests', 1, { method: 'POST', status: '201' });
      }

      expect(metrics.getCounter('http.requests', { method: 'GET', status: '200' })).toBe(100);
      expect(metrics.getCounter('http.requests', { method: 'POST', status: '201' })).toBe(20);

      const stats = metrics.getHistogramStats('http.duration', { method: 'GET' });
      expect(stats?.count).toBe(100);
      expect(stats?.min).toBeGreaterThanOrEqual(0);
      expect(stats?.max).toBeLessThanOrEqual(100);
    });
  });

  describe('Custom metrics', () => {
    test('tracks business metrics', () => {
      class BusinessMetrics {
        private events = new Map<string, any[]>();

        recordEvent(type: string, data: any) {
          const events = this.events.get(type) || [];
          events.push({
            ...data,
            timestamp: Date.now()
          });
          this.events.set(type, events);
        }

        getMetrics(type: string, window?: number) {
          const events = this.events.get(type) || [];
          const now = Date.now();

          const filtered = window ?
            events.filter(e => now - e.timestamp < window) :
            events;

          return {
            count: filtered.length,
            rate: window ? (filtered.length / window) * 1000 : null,
            latest: filtered[filtered.length - 1]
          };
        }

        getConversionRate(startEvent: string, endEvent: string) {
          const starts = this.events.get(startEvent) || [];
          const ends = this.events.get(endEvent) || [];

          if (starts.length === 0) return 0;
          return (ends.length / starts.length) * 100;
        }
      }

      const metrics = new BusinessMetrics();

      // Simulate user flow
      for (let i = 0; i < 100; i++) {
        metrics.recordEvent('page.view', { page: '/home' });

        if (Math.random() > 0.3) {
          metrics.recordEvent('button.click', { button: 'signup' });
        }

        if (Math.random() > 0.7) {
          metrics.recordEvent('user.signup', { plan: 'free' });
        }
      }

      const signupRate = metrics.getConversionRate('page.view', 'user.signup');
      expect(signupRate).toBeGreaterThan(0);
      expect(signupRate).toBeLessThan(50);
    });
  });
});
```

### 2. `tests/unit/observability/distributed-tracing.test.ts`

```typescript
/**
 * Distributed Tracing Tests
 */

describe('Distributed Tracing', () => {
  describe('Trace context propagation', () => {
    test('propagates trace context across services', () => {
      class TraceContext {
        traceId: string;
        spanId: string;
        parentSpanId?: string;
        baggage: Record<string, string> = {};

        constructor(traceId?: string, parentSpanId?: string) {
          this.traceId = traceId || this.generateId();
          this.spanId = this.generateId();
          this.parentSpanId = parentSpanId;
        }

        private generateId(): string {
          return Math.random().toString(36).substring(2, 18);
        }

        createChild(): TraceContext {
          const child = new TraceContext(this.traceId, this.spanId);
          child.baggage = { ...this.baggage };
          return child;
        }

        toHeaders(): Record<string, string> {
          return {
            'x-trace-id': this.traceId,
            'x-span-id': this.spanId,
            'x-parent-span-id': this.parentSpanId || '',
            'x-baggage': JSON.stringify(this.baggage)
          };
        }

        static fromHeaders(headers: Record<string, string>): TraceContext {
          const ctx = new TraceContext(
            headers['x-trace-id'],
            headers['x-parent-span-id']
          );
          ctx.spanId = headers['x-span-id'];
          ctx.baggage = headers['x-baggage'] ?
            JSON.parse(headers['x-baggage']) : {};
          return ctx;
        }
      }

      // Service A creates trace
      const rootTrace = new TraceContext();
      rootTrace.baggage.userId = '123';

      // Service A calls Service B
      const headers = rootTrace.toHeaders();

      // Service B receives trace
      const serviceB = TraceContext.fromHeaders(headers);
      expect(serviceB.traceId).toBe(rootTrace.traceId);
      expect(serviceB.parentSpanId).toBe('');
      expect(serviceB.baggage.userId).toBe('123');

      // Service B creates child span
      const childSpan = serviceB.createChild();
      expect(childSpan.traceId).toBe(rootTrace.traceId);
      expect(childSpan.parentSpanId).toBe(serviceB.spanId);
    });
  });

  describe('Span recording', () => {
    test('records span timing and attributes', () => {
      class Span {
        private startTime: number;
        private endTime?: number;
        private attributes: Record<string, any> = {};
        private events: Array<{ name: string; timestamp: number; attributes?: any }> = [];

        constructor(
          public name: string,
          public traceId: string,
          public spanId: string
        ) {
          this.startTime = performance.now();
        }

        setAttribute(key: string, value: any) {
          this.attributes[key] = value;
        }

        addEvent(name: string, attributes?: any) {
          this.events.push({
            name,
            timestamp: performance.now(),
            attributes
          });
        }

        end() {
          this.endTime = performance.now();
        }

        getDuration(): number | null {
          if (!this.endTime) return null;
          return this.endTime - this.startTime;
        }

        toJSON() {
          return {
            name: this.name,
            traceId: this.traceId,
            spanId: this.spanId,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.getDuration(),
            attributes: this.attributes,
            events: this.events
          };
        }
      }

      const span = new Span('api.request', 'trace-123', 'span-456');

      span.setAttribute('http.method', 'GET');
      span.setAttribute('http.url', '/api/users');

      span.addEvent('cache.hit', { key: 'users:all' });

      // Simulate some work
      const work = () => {
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
      };
      work();

      span.setAttribute('http.status', 200);
      span.end();

      const data = span.toJSON();
      expect(data.duration).toBeGreaterThan(0);
      expect(data.attributes['http.method']).toBe('GET');
      expect(data.events).toHaveLength(1);
      expect(data.events[0].name).toBe('cache.hit');
    });
  });

  describe('Sampling strategies', () => {
    test('implements adaptive sampling', () => {
      class AdaptiveSampler {
        private sampleRates = new Map<string, number>();
        private defaultRate = 0.1; // 10%

        shouldSample(operation: string, attributes?: any): boolean {
          // Always sample errors
          if (attributes?.error) return true;

          // Always sample slow requests
          if (attributes?.duration > 1000) return true;

          const rate = this.sampleRates.get(operation) || this.defaultRate;
          return Math.random() < rate;
        }

        adjustRate(operation: string, throughput: number) {
          // Adjust sample rate based on throughput
          if (throughput > 1000) {
            // High throughput - reduce sampling
            this.sampleRates.set(operation, 0.01);
          } else if (throughput > 100) {
            // Medium throughput
            this.sampleRates.set(operation, 0.1);
          } else {
            // Low throughput - sample more
            this.sampleRates.set(operation, 0.5);
          }
        }

        getRate(operation: string): number {
          return this.sampleRates.get(operation) || this.defaultRate;
        }
      }

      const sampler = new AdaptiveSampler();

      // Adjust rates based on throughput
      sampler.adjustRate('api.request', 5000);
      sampler.adjustRate('db.query', 50);

      expect(sampler.getRate('api.request')).toBe(0.01);
      expect(sampler.getRate('db.query')).toBe(0.5);

      // Always sample errors
      expect(sampler.shouldSample('api.request', { error: true })).toBe(true);

      // Sample based on rate
      let sampled = 0;
      for (let i = 0; i < 1000; i++) {
        if (sampler.shouldSample('api.request', {})) {
          sampled++;
        }
      }

      // Should be around 1% (10 requests)
      expect(sampled).toBeGreaterThan(5);
      expect(sampled).toBeLessThan(20);
    });
  });
});
```

### 3. `tests/unit/observability/health-checks.test.ts`

```typescript
/**
 * Health Check & Readiness Tests
 */

describe('Health Monitoring', () => {
  describe('Health checks', () => {
    test('implements comprehensive health checks', async () => {
      class HealthChecker {
        private checks = new Map<string, () => Promise<any>>();

        register(name: string, check: () => Promise<any>) {
          this.checks.set(name, check);
        }

        async checkHealth(): Promise<{
          status: 'healthy' | 'degraded' | 'unhealthy';
          checks: Record<string, any>;
        }> {
          const results: Record<string, any> = {};
          let hasFailures = false;
          let hasDegraded = false;

          for (const [name, check] of this.checks) {
            try {
              const startTime = Date.now();
              const result = await Promise.race([
                check(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Timeout')), 5000)
                )
              ]);

              results[name] = {
                status: 'healthy',
                responseTime: Date.now() - startTime,
                ...result
              };
            } catch (error: any) {
              hasFailures = true;
              results[name] = {
                status: 'unhealthy',
                error: error.message
              };
            }

            // Check if degraded
            if (results[name].responseTime > 1000) {
              hasDegraded = true;
              results[name].status = 'degraded';
            }
          }

          return {
            status: hasFailures ? 'unhealthy' :
                   hasDegraded ? 'degraded' : 'healthy',
            checks: results
          };
        }
      }

      const health = new HealthChecker();

      // Register checks
      health.register('database', async () => {
        // Simulate DB check
        await new Promise(r => setTimeout(r, 100));
        return { connections: 5, maxConnections: 20 };
      });

      health.register('redis', async () => {
        // Simulate Redis check
        await new Promise(r => setTimeout(r, 50));
        return { memory: '100MB', uptime: 3600 };
      });

      health.register('disk', async () => {
        return { usage: 45, threshold: 80 };
      });

      const result = await health.checkHealth();
      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.redis.status).toBe('healthy');
      expect(result.checks.disk.status).toBe('healthy');
    });

    test('implements readiness checks', async () => {
      class ReadinessChecker {
        private dependencies = new Map<string, boolean>();
        private initTasks = new Map<string, () => Promise<void>>();

        registerDependency(name: string, initFn: () => Promise<void>) {
          this.dependencies.set(name, false);
          this.initTasks.set(name, initFn);
        }

        async initialize() {
          const promises = [];

          for (const [name, initFn] of this.initTasks) {
            promises.push(
              initFn().then(() => {
                this.dependencies.set(name, true);
              }).catch(error => {
                console.error(`Failed to initialize ${name}:`, error);
                this.dependencies.set(name, false);
              })
            );
          }

          await Promise.all(promises);
        }

        isReady(): boolean {
          return Array.from(this.dependencies.values()).every(v => v);
        }

        getReadinessDetails() {
          const details: Record<string, boolean> = {};
          for (const [name, ready] of this.dependencies) {
            details[name] = ready;
          }
          return details;
        }
      }

      const readiness = new ReadinessChecker();

      readiness.registerDependency('database', async () => {
        await new Promise(r => setTimeout(r, 100));
        // Connected
      });

      readiness.registerDependency('cache', async () => {
        await new Promise(r => setTimeout(r, 50));
        // Warmed up
      });

      expect(readiness.isReady()).toBe(false);

      await readiness.initialize();

      expect(readiness.isReady()).toBe(true);
      expect(readiness.getReadinessDetails()).toEqual({
        database: true,
        cache: true
      });
    });
  });

  describe('Liveness probes', () => {
    test('detects deadlocks and hangs', async () => {
      class LivenessMonitor {
        private lastActivity = Date.now();
        private maxInactivity = 30000; // 30 seconds
        private watchdog?: NodeJS.Timeout;

        heartbeat() {
          this.lastActivity = Date.now();
        }

        startWatchdog(callback: () => void) {
          this.watchdog = setInterval(() => {
            const inactiveTime = Date.now() - this.lastActivity;
            if (inactiveTime > this.maxInactivity) {
              callback();
            }
          }, 5000);
        }

        stopWatchdog() {
          if (this.watchdog) {
            clearInterval(this.watchdog);
          }
        }

        getInactivityTime(): number {
          return Date.now() - this.lastActivity;
        }

        isAlive(): boolean {
          return this.getInactivityTime() < this.maxInactivity;
        }
      }

      const monitor = new LivenessMonitor();

      expect(monitor.isAlive()).toBe(true);

      // Simulate activity
      monitor.heartbeat();
      await new Promise(r => setTimeout(r, 100));
      monitor.heartbeat();

      expect(monitor.isAlive()).toBe(true);
      expect(monitor.getInactivityTime()).toBeLessThan(200);

      monitor.stopWatchdog();
    });
  });
});
```

### 4. `tests/unit/observability/logging-standards.test.ts`

```typescript
/**
 * Structured Logging Tests
 */

describe('Logging Standards', () => {
  describe('Structured logging', () => {
    test('implements structured log format', () => {
      class StructuredLogger {
        private correlationId?: string;

        setCorrelationId(id: string) {
          this.correlationId = id;
        }

        log(level: string, message: string, meta?: any) {
          const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            correlationId: this.correlationId,
            ...meta,
            // Ensure sensitive data is masked
            ...this.maskSensitive(meta)
          };

          return JSON.stringify(entry);
        }

        private maskSensitive(data: any): any {
          if (!data) return {};

          const masked = { ...data };
          const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];

          for (const key of Object.keys(masked)) {
            if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
              masked[key] = '***MASKED***';
            }
          }

          return masked;
        }

        info(message: string, meta?: any) {
          return this.log('INFO', message, meta);
        }

        error(message: string, error?: Error, meta?: any) {
          return this.log('ERROR', message, {
            ...meta,
            error: error ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            } : undefined
          });
        }

        audit(action: string, user: string, meta?: any) {
          return this.log('AUDIT', `User ${user} performed ${action}`, {
            ...meta,
            action,
            user,
            type: 'audit'
          });
        }
      }

      const logger = new StructuredLogger();
      logger.setCorrelationId('req-123');

      const logEntry = JSON.parse(
        logger.info('User login', {
          userId: 'user-456',
          password: 'secret123',
          ip: '192.168.1.1'
        })
      );

      expect(logEntry.level).toBe('INFO');
      expect(logEntry.correlationId).toBe('req-123');
      expect(logEntry.password).toBe('***MASKED***');
      expect(logEntry.ip).toBe('192.168.1.1');
    });
  });

  describe('Log aggregation', () => {
    test('implements log buffering and batching', async () => {
      class LogBuffer {
        private buffer: any[] = [];
        private maxSize = 100;
        private flushInterval = 1000;
        private flushTimer?: NodeJS.Timeout;

        add(entry: any) {
          this.buffer.push(entry);

          if (this.buffer.length >= this.maxSize) {
            this.flush();
          } else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
          }
        }

        private async flush() {
          if (this.buffer.length === 0) return;

          const batch = [...this.buffer];
          this.buffer = [];

          if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = undefined;
          }

          // Send batch to log aggregator
          await this.sendBatch(batch);
        }

        private async sendBatch(batch: any[]) {
          // Simulate sending to log aggregator
          return new Promise(r => setTimeout(r, 10));
        }

        getBufferSize() {
          return this.buffer.length;
        }

        async forceFlush() {
          await this.flush();
        }
      }

      const buffer = new LogBuffer();

      // Add logs
      for (let i = 0; i < 50; i++) {
        buffer.add({ message: `Log ${i}` });
      }

      expect(buffer.getBufferSize()).toBe(50);

      // Force flush
      await buffer.forceFlush();
      expect(buffer.getBufferSize()).toBe(0);
    });
  });
});
```

### 5. `tests/unit/observability/alerting-thresholds.test.ts`

```typescript
/**
 * Alerting & Threshold Tests
 */

describe('Alerting System', () => {
  describe('Threshold monitoring', () => {
    test('triggers alerts on threshold breach', () => {
      class AlertManager {
        private alerts: Array<any> = [];
        private thresholds = new Map<string, {
          value: number;
          operator: 'gt' | 'lt' | 'gte' | 'lte';
          cooldown: number;
        }>();
        private lastAlertTime = new Map<string, number>();

        setThreshold(
          metric: string,
          value: number,
          operator: 'gt' | 'lt' | 'gte' | 'lte' = 'gt',
          cooldown = 60000
        ) {
          this.thresholds.set(metric, { value, operator, cooldown });
        }

        checkMetric(metric: string, value: number) {
          const threshold = this.thresholds.get(metric);
          if (!threshold) return;

          const breached = this.isBreached(value, threshold.value, threshold.operator);

          if (breached) {
            const lastAlert = this.lastAlertTime.get(metric) || 0;
            const now = Date.now();

            if (now - lastAlert > threshold.cooldown) {
              this.triggerAlert(metric, value, threshold.value);
              this.lastAlertTime.set(metric, now);
            }
          }
        }

        private isBreached(value: number, threshold: number, operator: string): boolean {
          switch (operator) {
            case 'gt': return value > threshold;
            case 'lt': return value < threshold;
            case 'gte': return value >= threshold;
            case 'lte': return value <= threshold;
            default: return false;
          }
        }

        private triggerAlert(metric: string, value: number, threshold: number) {
          this.alerts.push({
            metric,
            value,
            threshold,
            timestamp: Date.now(),
            message: `${metric} is ${value}, threshold is ${threshold}`
          });
        }

        getAlerts() {
          return this.alerts;
        }
      }

      const alertManager = new AlertManager();

      // Set thresholds
      alertManager.setThreshold('cpu.usage', 80, 'gt');
      alertManager.setThreshold('memory.available', 100, 'lt');
      alertManager.setThreshold('error.rate', 5, 'gte');

      // Check metrics
      alertManager.checkMetric('cpu.usage', 85);
      alertManager.checkMetric('cpu.usage', 82); // Should be in cooldown
      alertManager.checkMetric('memory.available', 50);
      alertManager.checkMetric('error.rate', 5);

      const alerts = alertManager.getAlerts();
      expect(alerts).toHaveLength(3);
      expect(alerts[0].metric).toBe('cpu.usage');
      expect(alerts[1].metric).toBe('memory.available');
      expect(alerts[2].metric).toBe('error.rate');
    });
  });

  describe('Anomaly detection', () => {
    test('detects statistical anomalies', () => {
      class AnomalyDetector {
        private history = new Map<string, number[]>();
        private windowSize = 100;

        addDataPoint(metric: string, value: number) {
          const data = this.history.get(metric) || [];
          data.push(value);

          // Keep only recent data
          if (data.length > this.windowSize) {
            data.shift();
          }

          this.history.set(metric, data);
        }

        isAnomaly(metric: string, value: number, threshold = 3): boolean {
          const data = this.history.get(metric);
          if (!data || data.length < 10) return false;

          const mean = data.reduce((a, b) => a + b, 0) / data.length;
          const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
          const stdDev = Math.sqrt(variance);

          // Z-score
          const zScore = Math.abs((value - mean) / stdDev);
          return zScore > threshold;
        }

        getStats(metric: string) {
          const data = this.history.get(metric);
          if (!data || data.length === 0) return null;

          const mean = data.reduce((a, b) => a + b, 0) / data.length;
          const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;

          return {
            mean,
            stdDev: Math.sqrt(variance),
            min: Math.min(...data),
            max: Math.max(...data),
            count: data.length
          };
        }
      }

      const detector = new AnomalyDetector();

      // Add normal data
      for (let i = 0; i < 50; i++) {
        detector.addDataPoint('response.time', 100 + Math.random() * 20);
      }

      // Check normal value
      expect(detector.isAnomaly('response.time', 110)).toBe(false);

      // Check anomaly
      expect(detector.isAnomaly('response.time', 500)).toBe(true);

      const stats = detector.getStats('response.time');
      expect(stats?.mean).toBeGreaterThan(100);
      expect(stats?.mean).toBeLessThan(120);
    });
  });
});
```

## 📊 Success Metrics

- [ ] All 25+ observability tests passing
- [ ] Metrics collection accurate
- [ ] Distributed tracing working
- [ ] Health checks comprehensive
- [ ] Alerting thresholds effective
- [ ] Logging structured properly

## 🚀 Execution Instructions

1. Create all test files in `tests/unit/observability/`
2. Run tests: `npm run test:observability`
3. Implement missing observability features
4. Verify coverage: `npm run test:coverage -- --grep observability`

## 🔍 Files to Review & Fix

Priority observability files:
- `src/lib/metrics.ts` - Needs proper collection
- `src/lib/tracing.ts` - Missing distributed tracing
- `src/lib/logger.ts` - Needs structured format
- `src/api/health.ts` - Basic health checks only
- `src/lib/observability.ts` - Minimal implementation

## ⚠️ Critical Observability Gaps

1. **No distributed tracing** implementation
2. **Metrics collection** incomplete
3. **Health checks** too basic
4. **No anomaly detection**
5. **Missing alerting** system

## ✅ Completion Checklist

- [ ] Created all 5 test files
- [ ] 25+ observability tests written
- [ ] All tests passing
- [ ] Tracing implemented
- [ ] Metrics comprehensive
- [ ] Coverage report generated

---

**This workstream is independent and focuses solely on observability and monitoring.**