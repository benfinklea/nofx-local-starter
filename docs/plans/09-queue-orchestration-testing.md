# Testing Prompt 9: Queue & Orchestration Testing Suite

## Priority: MEDIUM 🟡
**Estimated Time:** 5 hours
**Coverage Target:** 90% for queue systems and orchestration services

## Objective
Implement comprehensive test coverage for message queues, job orchestration, event routing, task scheduling, and distributed coordination. These systems are critical for system scalability and reliability.

## Files to Test

### Queue Infrastructure
- `src/lib/queue.ts` (Modified → 90%)
- `src/lib/queue/RedisAdapter.ts` (Tested → 95%)
- `src/api/routes/queue.ts` (0% → 85%)

### Orchestration & Coordination
- `src/lib/orchestration.ts` (0% → 90%)
- `src/lib/events.ts` (0% → 85%)
- `src/shared/responses/eventRouter.ts` (0% → 90%)

### Worker Management
- `src/worker/main.ts` (Modified → 85%)
- `src/api/server/routes.ts` (Modified → 85%)

### Monitoring & Observability
- `src/lib/observability.ts` (Modified → 90%)
- `src/lib/logger.ts` (Modified → 85%)
- `src/lib/metrics.ts` (Tested → 95%)

## Testing Framework & Tools

### Primary Testing Framework: Jest
All queue and orchestration tests MUST use Jest with proper async handling and timing control.

### Using the test-generator Subagent
Utilize the test-generator for complex orchestration scenarios:
```bash
# Generate queue adapter tests
/test-generator "Create comprehensive tests for RedisAdapter with connection pooling and failover"

# Generate orchestration workflow tests
/test-generator "Generate tests for distributed task orchestration with failure recovery"

# Create event routing tests
/test-generator "Create tests for event routing with prioritization and dead letter queues"

# Generate concurrency tests
/test-generator "Generate tests for concurrent job processing with rate limiting"
```

The test-generator subagent will:
- Analyze queue patterns and generate tests
- Create distributed system test scenarios
- Generate load testing configurations
- Build failure injection tests
- Create timing-sensitive test cases

### Required Testing Tools
- **Jest**: Primary framework
- **redis-mock**: Mock Redis for queue tests
- **bull-mock**: Mock Bull queue
- **p-queue**: Test queue implementations
- **jest-circus**: Advanced test orchestration

## Test Requirements

### 1. Unit Tests - Queue Adapter
```typescript
// RedisAdapter comprehensive tests with Jest:
describe('RedisAdapter', () => {
  let adapter: RedisAdapter;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockRedis = createMockRedis();
    adapter = new RedisAdapter(mockRedis);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('message enqueuing', () => {
    test('enqueues message with priority', async () => {
      const message = {
        id: 'msg-123',
        payload: { action: 'process' },
        priority: 10
      };

      await adapter.enqueue('tasks', message);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'queue:tasks',
        10,
        JSON.stringify(message)
      );
    });

    test('handles batch enqueue operations', async () => {
      const messages = Array(100).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        payload: { index: i },
        priority: i % 5
      }));

      await adapter.enqueueBatch('tasks', messages);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockRedis.exec).toHaveBeenCalled();
    });

    test('respects queue capacity limits', async () => {
      adapter.setCapacity('tasks', 10);

      const messages = Array(15).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        payload: { index: i }
      }));

      const results = await Promise.allSettled(
        messages.map(msg => adapter.enqueue('tasks', msg))
      );

      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected).toHaveLength(5);
    });
  });

  describe('message dequeuing', () => {
    test('dequeues by priority order', async () => {
      mockRedis.bzpopmax.mockResolvedValue([
        'queue:tasks',
        JSON.stringify({ id: 'high-priority' }),
        '10'
      ]);

      const message = await adapter.dequeue('tasks');

      expect(message.id).toBe('high-priority');
      expect(mockRedis.bzpopmax).toHaveBeenCalledWith(
        'queue:tasks',
        expect.any(Number)
      );
    });

    test('implements visibility timeout', async () => {
      const message = await adapter.dequeue('tasks', {
        visibilityTimeout: 30000
      });

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'queue:tasks:processing',
        expect.any(Number),
        expect.any(String)
      );

      // Verify message returns to queue after timeout
      jest.advanceTimersByTime(30001);

      expect(mockRedis.zrangebyscore).toHaveBeenCalled();
    });

    test('handles concurrent dequeue operations', async () => {
      const dequeuers = Array(10).fill(null).map(() =>
        adapter.dequeue('tasks')
      );

      const results = await Promise.all(dequeuers);
      const uniqueMessages = new Set(results.map(r => r?.id));

      expect(uniqueMessages.size).toBe(results.filter(Boolean).length);
    });
  });

  describe('dead letter queue', () => {
    test('moves failed messages to DLQ after max retries', async () => {
      const message = {
        id: 'msg-fail',
        payload: { action: 'fail' },
        retries: 3,
        maxRetries: 3
      };

      await adapter.markFailed('tasks', message);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'queue:tasks:dlq',
        expect.any(Number),
        expect.stringContaining('msg-fail')
      );
    });

    test('processes DLQ messages for retry', async () => {
      const dlqMessages = await adapter.processDLQ('tasks', {
        batchSize: 10,
        retryStrategy: 'exponential'
      });

      expect(dlqMessages).toHaveLength(10);
      expect(mockRedis.zrem).toHaveBeenCalled();
    });
  });

  // Additional scenarios:
  // - Connection pooling
  // - Failover handling
  // - Queue metrics collection
  // - Message TTL
  // - Queue pausing/resuming
  // - Scheduled messages
});
```

### 2. Unit Tests - Orchestration Service
```typescript
describe('OrchestrationService', () => {
  let orchestrator: OrchestrationService;
  let mockQueue: jest.Mocked<QueueService>;

  beforeEach(() => {
    mockQueue = createMockQueue();
    orchestrator = new OrchestrationService(mockQueue);
  });

  describe('workflow execution', () => {
    test('executes linear workflow', async () => {
      const workflow = {
        id: 'wf-123',
        steps: [
          { id: 'step1', handler: 'process' },
          { id: 'step2', handler: 'validate' },
          { id: 'step3', handler: 'complete' }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.executedSteps).toHaveLength(3);
      expect(mockQueue.enqueue).toHaveBeenCalledTimes(3);
    });

    test('handles parallel execution', async () => {
      const workflow = {
        id: 'wf-parallel',
        steps: [
          { id: 'step1', handler: 'process' },
          {
            id: 'parallel-group',
            parallel: [
              { id: 'step2a', handler: 'validate' },
              { id: 'step2b', handler: 'enrich' }
            ]
          },
          { id: 'step3', handler: 'complete' }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow);

      expect(result.parallelExecutions).toHaveLength(1);
      expect(result.totalDuration).toBeLessThan(
        result.executedSteps.reduce((sum, s) => sum + s.duration, 0)
      );
    });

    test('implements conditional branching', async () => {
      const workflow = {
        id: 'wf-conditional',
        steps: [
          { id: 'check', handler: 'evaluate' },
          {
            id: 'branch',
            condition: '${check.result} === "approved"',
            then: { id: 'approve', handler: 'process' },
            else: { id: 'reject', handler: 'notify' }
          }
        ]
      };

      const result = await orchestrator.executeWorkflow(workflow, {
        context: { 'check.result': 'approved' }
      });

      expect(result.executedSteps).toContainEqual(
        expect.objectContaining({ id: 'approve' })
      );
      expect(result.executedSteps).not.toContainEqual(
        expect.objectContaining({ id: 'reject' })
      );
    });

    test('handles workflow compensation on failure', async () => {
      const workflow = {
        id: 'wf-saga',
        steps: [
          { id: 'reserve', handler: 'reserve', compensate: 'release' },
          { id: 'charge', handler: 'charge', compensate: 'refund' },
          { id: 'ship', handler: 'ship', compensate: 'recall' }
        ]
      };

      // Simulate failure at ship step
      mockQueue.enqueue.mockRejectedValueOnce(new Error('Shipping failed'));

      const result = await orchestrator.executeWorkflow(workflow);

      expect(result.status).toBe('compensated');
      expect(result.compensatedSteps).toEqual(['charge', 'reserve']);
    });
  });

  describe('state management', () => {
    test('persists workflow state', async () => {
      const workflow = { id: 'wf-stateful' };

      await orchestrator.saveState(workflow.id, {
        currentStep: 'step2',
        variables: { counter: 5 }
      });

      const state = await orchestrator.loadState(workflow.id);

      expect(state.currentStep).toBe('step2');
      expect(state.variables.counter).toBe(5);
    });

    test('implements checkpointing', async () => {
      const workflow = {
        id: 'wf-checkpoint',
        steps: Array(10).fill(null).map((_, i) => ({
          id: `step${i}`,
          handler: 'process',
          checkpoint: i % 3 === 0
        }))
      };

      await orchestrator.executeWorkflow(workflow);

      const checkpoints = await orchestrator.getCheckpoints(workflow.id);
      expect(checkpoints).toHaveLength(4); // Steps 0, 3, 6, 9
    });
  });

  // Additional orchestration tests:
  // - Timeout handling
  // - Rate limiting
  // - Circuit breaker pattern
  // - Workflow versioning
  // - Dynamic workflow modification
  // - Workflow templates
});
```

### 3. Integration Tests - Event Router
```typescript
describe('EventRouter Integration', () => {
  let router: EventRouter;
  let mockHandlers: Map<string, jest.Mock>;

  beforeEach(() => {
    mockHandlers = new Map();
    router = new EventRouter();

    // Register mock handlers
    ['order.created', 'order.shipped', 'order.cancelled'].forEach(event => {
      const handler = jest.fn();
      mockHandlers.set(event, handler);
      router.on(event, handler);
    });
  });

  test('routes events to correct handlers', async () => {
    const events = [
      { type: 'order.created', data: { id: '123' } },
      { type: 'order.shipped', data: { id: '124' } },
      { type: 'order.created', data: { id: '125' } }
    ];

    await Promise.all(events.map(e => router.emit(e.type, e.data)));

    expect(mockHandlers.get('order.created')).toHaveBeenCalledTimes(2);
    expect(mockHandlers.get('order.shipped')).toHaveBeenCalledTimes(1);
    expect(mockHandlers.get('order.cancelled')).not.toHaveBeenCalled();
  });

  test('supports wildcard subscriptions', async () => {
    const wildcardHandler = jest.fn();
    router.on('order.*', wildcardHandler);

    await router.emit('order.created', { id: '126' });
    await router.emit('order.updated', { id: '126' });
    await router.emit('payment.processed', { id: '126' });

    expect(wildcardHandler).toHaveBeenCalledTimes(2);
  });

  test('implements event replay', async () => {
    const events = [];
    router.on('*', (event) => events.push(event));

    // Emit events
    await router.emit('event1', { data: 1 });
    await router.emit('event2', { data: 2 });

    // Clear and replay
    events.length = 0;
    await router.replay('2024-01-01T00:00:00Z', '2024-01-01T23:59:59Z');

    expect(events).toHaveLength(2);
  });

  test('handles backpressure', async () => {
    const slowHandler = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    router.on('slow.event', slowHandler, { concurrency: 2 });

    // Send 10 events
    const promises = Array(10).fill(null).map((_, i) =>
      router.emit('slow.event', { index: i })
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    // Should take ~500ms (5 batches of 2)
    expect(duration).toBeGreaterThan(400);
    expect(duration).toBeLessThan(600);
  });
});
```

### 4. Unit Tests - Worker Main
```typescript
describe('Worker Process', () => {
  let worker: Worker;

  describe('job processing', () => {
    test('processes jobs continuously', async () => {
      const jobs = Array(5).fill(null).map((_, i) => ({
        id: `job-${i}`,
        type: 'process',
        data: { index: i }
      }));

      const worker = new Worker({
        concurrency: 2,
        pollInterval: 100
      });

      const processed = [];
      worker.on('completed', (job) => processed.push(job));

      worker.start();

      // Add jobs to queue
      for (const job of jobs) {
        await worker.addJob(job);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      worker.stop();

      expect(processed).toHaveLength(5);
    });

    test('implements graceful shutdown', async () => {
      const worker = new Worker();
      const activeJobs = new Set();

      worker.on('started', (job) => activeJobs.add(job.id));
      worker.on('completed', (job) => activeJobs.delete(job.id));

      worker.start();

      // Add long-running jobs
      await worker.addJob({ id: '1', duration: 1000 });
      await worker.addJob({ id: '2', duration: 1000 });

      // Initiate graceful shutdown
      const shutdownPromise = worker.shutdown();

      // Should not accept new jobs
      await expect(worker.addJob({ id: '3' }))
        .rejects.toThrow('Worker is shutting down');

      await shutdownPromise;

      expect(activeJobs.size).toBe(0);
    });

    test('handles worker crashes', async () => {
      const worker = new Worker({
        maxCrashes: 3,
        crashWindow: 60000
      });

      const crashes = [];
      worker.on('crash', (error) => crashes.push(error));

      // Simulate crashes
      for (let i = 0; i < 3; i++) {
        await worker.simulateCrash(new Error(`Crash ${i}`));
      }

      expect(crashes).toHaveLength(3);
      expect(worker.isHealthy()).toBe(false);

      // Should stop accepting work after max crashes
      await expect(worker.addJob({ id: 'test' }))
        .rejects.toThrow('Worker is unhealthy');
    });
  });

  // Additional worker tests:
  // - Memory leak detection
  // - CPU throttling
  // - Job timeout handling
  // - Heartbeat mechanism
  // - Cluster coordination
});
```

### 5. Performance Tests
```typescript
describe('Queue Performance', () => {
  test('handles high throughput', async () => {
    const queue = new QueueService();
    const messageCount = 10000;

    const start = Date.now();

    // Enqueue messages
    const enqueuePromises = Array(messageCount).fill(null).map((_, i) =>
      queue.enqueue({ id: `msg-${i}`, data: i })
    );

    await Promise.all(enqueuePromises);

    const enqueueDuration = Date.now() - start;
    const enqueueRate = messageCount / (enqueueDuration / 1000);

    expect(enqueueRate).toBeGreaterThan(5000); // 5000 msg/sec minimum

    // Dequeue messages
    const dequeueStart = Date.now();
    const messages = [];

    while (messages.length < messageCount) {
      const msg = await queue.dequeue();
      if (msg) messages.push(msg);
    }

    const dequeueDuration = Date.now() - dequeueStart;
    const dequeueRate = messageCount / (dequeueDuration / 1000);

    expect(dequeueRate).toBeGreaterThan(3000); // 3000 msg/sec minimum
  });

  test('maintains order under load', async () => {
    const queue = new PriorityQueue();
    const messages = Array(1000).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      priority: Math.floor(Math.random() * 10),
      sequence: i
    }));

    // Concurrent enqueue
    await Promise.all(messages.map(m => queue.enqueue(m)));

    // Dequeue and verify priority order
    const dequeued = [];
    let msg;
    while ((msg = await queue.dequeue())) {
      dequeued.push(msg);
    }

    // Verify high priority messages came first
    const highPriority = dequeued.filter(m => m.priority >= 8);
    const lowPriority = dequeued.filter(m => m.priority < 3);

    const avgHighPosition = highPriority.reduce((sum, m, i) => sum + i, 0) / highPriority.length;
    const avgLowPosition = lowPriority.reduce((sum, m, i) => sum + i, 0) / lowPriority.length;

    expect(avgHighPosition).toBeLessThan(avgLowPosition);
  });
});
```

## Edge Cases to Test

1. **Queue Edge Cases**
   - Queue overflow scenarios
   - Empty queue polling
   - Message duplication
   - Out-of-order delivery
   - Poison messages

2. **Orchestration Edge Cases**
   - Cyclic workflow detection
   - Infinite loops
   - State corruption
   - Version mismatches
   - Resource exhaustion

3. **Concurrency Edge Cases**
   - Race conditions
   - Deadlocks
   - Starvation
   - Thundering herd
   - Split-brain scenarios

4. **Network Edge Cases**
   - Partition tolerance
   - Message loss
   - Duplicate delivery
   - Reordering
   - Byzantine failures

## Performance Requirements

- Message enqueue: < 1ms
- Message dequeue: < 2ms
- Workflow step execution: < 100ms
- Event routing: < 5ms
- State persistence: < 10ms
- Queue throughput: > 10,000 msg/sec

## Expected Outcomes

1. **Reliability**: 99.99% message delivery guarantee
2. **Scalability**: Linear scaling to 100 workers
3. **Latency**: P99 < 100ms for message processing
4. **Durability**: Zero message loss on failure
5. **Ordering**: FIFO/Priority order maintained

## Validation Checklist

- [ ] All queue operations tested
- [ ] Orchestration patterns validated
- [ ] Event routing verified
- [ ] Concurrency scenarios tested
- [ ] Performance benchmarks met
- [ ] Failure recovery tested
- [ ] Monitoring integration verified
- [ ] Dead letter queue tested
- [ ] Rate limiting validated
- [ ] Graceful shutdown tested

## Jest Configuration for Queue Tests

```javascript
// jest.config.js for queue tests
module.exports = {
  // ... existing config
  projects: [
    {
      displayName: 'queue-unit',
      testMatch: ['<rootDir>/src/lib/queue/**/*.test.ts'],
      testEnvironment: 'node'
    },
    {
      displayName: 'queue-integration',
      testMatch: ['<rootDir>/tests/integration/queue/**/*.test.ts'],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/setup/redis.js'
    }
  ]
};

// tests/setup/redis.js
const Redis = require('ioredis-mock');

module.exports = async () => {
  global.redis = new Redis();
};
```

## Testing Best Practices

1. **Timing Control**
   - Use fake timers for time-dependent tests
   - Control concurrency with semaphores
   - Test timeout scenarios
   - Verify retry delays

2. **State Management**
   - Reset queue state between tests
   - Use transactions for test isolation
   - Verify state persistence
   - Test state recovery

3. **Load Testing**
   - Use realistic message sizes
   - Test sustained load
   - Measure memory usage
   - Monitor queue depths