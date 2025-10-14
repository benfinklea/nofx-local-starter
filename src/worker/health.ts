import express from 'express';
import { createServer } from 'http';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { log } from '../lib/logger';
// import { getQueueCounts, isQueueHealthy } from '../lib/queue';

const app = express();
const PORT = process.env.HEALTH_CHECK_PORT || 3001;

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    redis: HealthCheck;
    database: HealthCheck;
    queue: HealthCheck;
    memory: HealthCheck;
  };
  metrics?: {
    queueDepth?: number;
    processingRate?: number;
    errorRate?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  latency?: number;
}

const startTime = Date.now();
let processedCount = 0;
let errorCount = 0;

// Track processed jobs (called from runner)
export function incrementProcessed() {
  processedCount++;
}

export function incrementErrors() {
  errorCount++;
}

async function checkRedis(): Promise<HealthCheck> {
  if (process.env.QUEUE_DRIVER !== 'redis') {
    return { status: 'pass', message: 'Redis not required (memory mode)' };
  }

  const start = Date.now();
  try {
    const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });

    await redis.ping();
    const latency = Date.now() - start;
    redis.disconnect();

    return {
      status: 'pass',
      message: 'Redis connection healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${error}`,
      latency: Date.now() - start,
    };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  if (!process.env.DATABASE_URL) {
    return { status: 'warn', message: 'No database configured' };
  }

  const start = Date.now();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 3000,
  });

  try {
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    await pool.end();

    return {
      status: 'pass',
      message: 'Database connection healthy',
      latency,
    };
  } catch (error) {
    await pool.end().catch(() => {});
    return {
      status: 'fail',
      message: `Database connection failed: ${error}`,
      latency: Date.now() - start,
    };
  }
}

async function checkQueue(): Promise<HealthCheck> {
  try {
    // TODO: Implement when queue module exports these functions
    const isHealthy = true; // await isQueueHealthy();
    if (!isHealthy) {
      return {
        status: 'fail',
        message: 'Queue is not processing jobs',
      };
    }

    // TODO: Implement when queue module exports these functions
    const counts = { waiting: 0, delayed: 0 }; // await getQueueCounts('step.ready');
    const queueDepth = counts.waiting + counts.delayed;

    if (queueDepth > 1000) {
      return {
        status: 'warn',
        message: `Queue backlog high: ${queueDepth} jobs`,
      };
    }

    return {
      status: 'pass',
      message: `Queue healthy, ${queueDepth} jobs pending`,
    };
  } catch (error) {
    return {
      status: 'warn',
      message: `Queue check failed: ${error}`,
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const percentage = (heapUsedMB / heapTotalMB) * 100;

  if (percentage > 90) {
    return {
      status: 'fail',
      message: `Memory usage critical: ${percentage.toFixed(1)}%`,
    };
  } else if (percentage > 75) {
    return {
      status: 'warn',
      message: `Memory usage high: ${percentage.toFixed(1)}%`,
    };
  }

  return {
    status: 'pass',
    message: `Memory usage: ${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB`,
  };
}

async function getHealthStatus(): Promise<HealthStatus> {
  const [redis, database, queue, memory] = await Promise.all([
    checkRedis(),
    checkDatabase(),
    checkQueue(),
    checkMemory(),
  ]);

  const checks = { redis, database, queue, memory };
  const failedChecks = Object.values(checks).filter(c => c.status === 'fail');
  const warnChecks = Object.values(checks).filter(c => c.status === 'warn');

  let status: HealthStatus['status'] = 'healthy';
  if (failedChecks.length > 0) {
    status = 'unhealthy';
  } else if (warnChecks.length > 0) {
    status = 'degraded';
  }

  const uptime = Date.now() - startTime;
  const processingRate = processedCount / (uptime / 1000); // per second
  const errorRate = errorCount / Math.max(processedCount, 1);

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    checks,
    metrics: {
      queueDepth: 0, // await getQueueCounts('step.ready').then(c => c.waiting + c.delayed).catch(() => 0),
      processingRate,
      errorRate,
      memoryUsage: process.memoryUsage(),
    },
  };
}

// Health check endpoints
app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/health/live', (_req, res) => {
  // Liveness probe - just check if process is running
  res.status(200).json({ status: 'alive' });
});

app.get('/health/ready', async (_req, res) => {
  // Readiness probe - check if worker can process jobs
  const health = await getHealthStatus();
  if (health.status === 'unhealthy') {
    res.status(503).json({ ready: false, reason: health.checks });
  } else {
    res.status(200).json({ ready: true });
  }
});

app.get('/metrics', async (_req, res) => {
  // Prometheus-style metrics
  const health = await getHealthStatus();
  const metrics = [
    `# HELP worker_uptime_seconds Worker uptime in seconds`,
    `# TYPE worker_uptime_seconds gauge`,
    `worker_uptime_seconds ${health.uptime / 1000}`,
    '',
    `# HELP worker_processed_total Total processed jobs`,
    `# TYPE worker_processed_total counter`,
    `worker_processed_total ${processedCount}`,
    '',
    `# HELP worker_errors_total Total errors`,
    `# TYPE worker_errors_total counter`,
    `worker_errors_total ${errorCount}`,
    '',
    `# HELP worker_queue_depth Current queue depth`,
    `# TYPE worker_queue_depth gauge`,
    `worker_queue_depth ${health.metrics?.queueDepth || 0}`,
    '',
    `# HELP worker_memory_heap_used_bytes Heap memory used`,
    `# TYPE worker_memory_heap_used_bytes gauge`,
    `worker_memory_heap_used_bytes ${health.metrics?.memoryUsage?.heapUsed || 0}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

let server: ReturnType<typeof createServer>;

export function startHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    // Skip health server startup during tests to avoid port conflicts
    if (process.env.DISABLE_SERVER_AUTOSTART === '1') {
      log.info('Health check server disabled (test mode)');
      resolve();
      return;
    }

    server = createServer(app);
    server.listen(PORT, () => {
      log.info({ port: PORT }, 'Health check server started');
      resolve();
    });
  });
}

export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        log.info('Health check server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await stopHealthServer();
});

process.on('SIGINT', async () => {
  await stopHealthServer();
});