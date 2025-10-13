# Test Failure Report

**Total Failed Tests:** 284

**Failed Test Files:** 20

---


## tests/unit/store.test.ts

### 1. Store Module › Run Operations - FS Driver › createRun › should create a run with FS driver

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 2. Store Module › Run Operations - FS Driver › createRun › should handle null plan

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 3. Store Module › Run Operations - FS Driver › createRun › should handle undefined plan

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 4. Store Module › Run Operations - FS Driver › createRun › should include projectId in run

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 5. Store Module › Step Operations - FS Driver › createStep › should create a step

```
expect(received).toMatchObject(expected)
- Expected  - 1
+ Received  + 1
@@ -1,8 +1,8 @@
Object {
```

### 6. Store Module › Event Operations - FS Driver › recordEvent › should record event to events file

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "/Volumes/Development/nofx-local-starter/local_data/runs/run-id/events/test-uuid-123.json", StringMatching /"type":\s*"test-event"/
Received: "/Volumes/Development/nofx-local-starter/local_data/runs/run-id/events/undefined.json", "{
\"run_id\": \"run-id\",
\"type\": \"test-event\",
```

### 7. Store Module › Gate Operations - FS Driver › createOrGetGate › should create new gate if none exists

```
expect(received).toMatchObject(expected)
- Expected  - 1
+ Received  + 1
Object {
"gate_type": "approval",
```

### 8. Store Module › Artifact Operations - FS Driver › addArtifact › should add artifact to artifacts file

```
expect(received).toMatchObject(expected)
- Expected  - 1
+ Received  + 1
@@ -1,7 +1,7 @@
Object {
```

### 9. Store Module › User Operations - DB Driver › createRunWithUser › should fallback to regular createRun for FS driver

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 10. Store Module › Edge Cases and Error Handling › should handle large payloads

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 11. Store Module › Integration Scenarios › should handle complete run lifecycle

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```

### 12. Store Module › Integration Scenarios › should handle idempotency correctly

```
TypeError: The "path" argument must be of type string. Received undefined
95 |    */
96 |   getRunDirectory(runId: string, root: string): string {
>  97 |     const fullPath = path.join(root, 'runs', runId);
|                           ^
```


## src/lib/__tests__/orchestration.test.ts

### 13. Orchestration Service - Comprehensive Tests › Session Management › createOrchestrationSession › creates a solo orchestration session

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 14. Orchestration Service - Comprehensive Tests › Session Management › createOrchestrationSession › creates a hierarchical orchestration session with relationships

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 15. Orchestration Service - Comprehensive Tests › Session Management › createOrchestrationSession › calculates cost and duration estimates

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 16. Orchestration Service - Comprehensive Tests › Session Management › createOrchestrationSession › throws error when no agents match criteria

```
expect(received).rejects.toThrow(expected)
Expected substring: "No agents match the selection criteria"
Received message:   "Cannot read properties of undefined (reading 'result')"
87 |     };
88 |   });
```

### 17. Orchestration Service - Comprehensive Tests › Session Management › updateOrchestrationSession › updates session status

```
TypeError: Cannot read properties of undefined (reading 'result')
132 |     return mapSessionRow(result.rows[0]);
133 |   });
> 134 |   return result.result;
|                 ^
```

### 18. Orchestration Service - Comprehensive Tests › Session Management › updateOrchestrationSession › updates performance metrics

```
TypeError: Cannot read properties of undefined (reading 'result')
132 |     return mapSessionRow(result.rows[0]);
133 |   });
> 134 |   return result.result;
|                 ^
```

### 19. Orchestration Service - Comprehensive Tests › Session Management › updateOrchestrationSession › throws error when session not found

```
expect(received).rejects.toThrow(expected)
Expected substring: "Session nonexistent-session not found"
Received message:   "Cannot read properties of undefined (reading 'result')"
132 |     return mapSessionRow(result.rows[0]);
133 |   });
```

### 20. Orchestration Service - Comprehensive Tests › Session Management › listOrchestrationSessions › lists sessions with pagination

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 21. Orchestration Service - Comprehensive Tests › Session Management › listOrchestrationSessions › filters sessions by orchestration type

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 22. Orchestration Service - Comprehensive Tests › Session Management › listOrchestrationSessions › filters sessions by date range

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 23. Orchestration Service - Comprehensive Tests › Agent Selection and Routing › selectAgentsForOrchestration › selects agents with structured capabilities

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 24. Orchestration Service - Comprehensive Tests › Agent Selection and Routing › selectAgentsForOrchestration › falls back to JSONB capabilities when structured fails

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 25. Orchestration Service - Comprehensive Tests › Agent Selection and Routing › selectAgentsForOrchestration › selects agents for pair orchestration

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 26. Orchestration Service - Comprehensive Tests › Agent Selection and Routing › selectAgentsForOrchestration › selects agents for swarm orchestration

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 27. Orchestration Service - Comprehensive Tests › Agent Selection and Routing › selectAgentsForOrchestration › respects cost budget constraints

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 28. Orchestration Service - Comprehensive Tests › Agent Communication › sendAgentMessage › sends message between agents

```
TypeError: Cannot read properties of undefined (reading 'result')
471 |     };
472 |   });
> 473 |   return result.result;
|                 ^
```

### 29. Orchestration Service - Comprehensive Tests › Agent Communication › sendAgentMessage › handles message acknowledgment

```
TypeError: Cannot read properties of undefined (reading 'result')
471 |     };
472 |   });
> 473 |   return result.result;
|                 ^
```

### 30. Orchestration Service - Comprehensive Tests › Agent Communication › sendAgentMessage › throws error when session is inactive

```
expect(received).rejects.toThrow(expected)
Expected substring: "Cannot send message to inactive session"
Received message:   "Cannot read properties of undefined (reading 'result')"
471 |     };
472 |   });
```

### 31. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles database transaction failures

```
expect(received).rejects.toThrow(expected)
Expected substring: "Transaction failed"
Received message:   "Cannot read properties of undefined (reading 'result')"
87 |     };
88 |   });
```

### 32. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles empty agent selection results gracefully

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 33. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles malformed capability data

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 34. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles missing session metadata

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 35. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles no capability requirements

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 36. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles pair orchestration with only one agent

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 37. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles hierarchical orchestration without workers

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 38. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles swarm with more than 10 agents

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 39. Orchestration Service - Comprehensive Tests › Error Handling and Edge Cases › handles default orchestration type

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 40. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › filters agents with resource constraints

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 41. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › calculates agent cost correctly

```
TypeError: Cannot read properties of undefined (reading 'result')
241 |     return selectedAgents;
242 |   });
> 243 |   return result.result;
|                 ^
```

### 42. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › creates session without agents selected

```
TypeError: Cannot read properties of undefined (reading 'result')
87 |     };
88 |   });
> 89 |   return result.result;
|                 ^
```

### 43. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › handles messages without acknowledgment requirement

```
TypeError: Cannot read properties of undefined (reading 'result')
471 |     };
472 |   });
> 473 |   return result.result;
|                 ^
```

### 44. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › lists sessions with no filters

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 45. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › handles empty session list result

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 46. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › filters sessions by primary agent ID

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 47. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › uses cursor for pagination

```
TypeError: Cannot read properties of undefined (reading 'result')
198 |     };
199 |   });
> 200 |   return result.result;
|                 ^
```

### 48. Orchestration Service - Comprehensive Tests › Additional Coverage - Helper Functions › updates session with no fields

```
TypeError: Cannot read properties of undefined (reading 'result')
132 |     return mapSessionRow(result.rows[0]);
133 |   });
> 134 |   return result.result;
|                 ^
```


## src/api/routes/__tests__/responses.test.ts

### 49. Response API Routes - Comprehensive Tests › GET /responses/runs/:id › returns complete run timeline and data

```
expect(received).toMatchObject(expected)
- Expected  - 8
+ Received  + 0
@@ -1,8 +1,6 @@
Object {
```


## tests/unit/handlers/runs.test.ts

### 50. Runs Handlers › handleCreateRun › should process steps and enqueue them

```
expect(jest.fn()).toHaveBeenCalled()
Expected number of calls: >= 1
Received number of calls:    0
338 |       await new Promise(resolve => setTimeout(resolve, 10));
339 |
```

### 51. Runs Handlers › handleCreateRun › should handle steps with security policy

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-123", "step1", "bash", ObjectContaining {"_policy": ObjectContaining {"env_allowed": ["PATH"], "secrets_scope": "project", "tools_allowed": ["bash"]}, "command": "test"}, Any<String>
Number of calls: 0
367 |       await new Promise(resolve => setTimeout(resolve, 10));
368 |
```

### 52. Runs Handlers › handleCreateRun › should handle backpressure with queue age

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step.ready", Any<Object>, ObjectContaining {"delay": Any<Number>}
Number of calls: 0
418 |       await new Promise(resolve => setTimeout(resolve, 10));
419 |
```

### 53. Runs Handlers › handleCreateRun › should handle inline execution for memory queue

```
expect(jest.fn()).toHaveBeenCalled()
Expected number of calls: >= 1
Received number of calls:    0
437 |
438 |       // Verify inline execution was attempted
```

### 54. Runs Handlers › handleCreateRun › should record backpressure event when queue age exceeds threshold

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-123", "queue.backpressure", ObjectContaining {"ageMs": 10000, "delayMs": Any<Number>}, "step-123"
Received: "run-123", "run.created", {"plan": {"goal": "test", "steps": [{"inputs": {"command": "echo test"}, "name": "step1", "tool": "bash"}]}}
Number of calls: 1
496 |       await new Promise(resolve => setTimeout(resolve, 10));
```

### 55. Runs Handlers › handleCreateRun › should handle inline execution errors

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: ObjectContaining {"runId": "run-123", "stepId": "step-123"}, "Inline step execution failed"
Received: {"error": [TypeError: Cannot convert undefined or null to object], "runId": "run-123", "stepName": "step1"}, "Failed to process step"
Number of calls: 1
557 |       await new Promise(resolve => setTimeout(resolve, 10));
```


## src/lib/queue/__tests__/RedisAdapter.test.ts

### 56. RedisQueueAdapter - Integration Tests › Queue Management › creates and reuses queue instances

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 57. RedisQueueAdapter - Integration Tests › Queue Management › creates different queues for different topics

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 58. RedisQueueAdapter - Integration Tests › Job Enqueuing › enqueues jobs successfully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 59. RedisQueueAdapter - Integration Tests › Job Enqueuing › enqueues jobs with options

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 60. RedisQueueAdapter - Integration Tests › Job Enqueuing › handles enqueue errors gracefully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 61. RedisQueueAdapter - Integration Tests › Worker Subscription › creates worker with correct configuration

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 62. RedisQueueAdapter - Integration Tests › Worker Subscription › sets up worker event handlers

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 63. RedisQueueAdapter - Integration Tests › Worker Subscription › respects worker concurrency environment variable

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 64. RedisQueueAdapter - Integration Tests › Worker Subscription › uses fallback concurrency when env var not set

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 65. RedisQueueAdapter - Integration Tests › Job Counts and Metrics › gets job counts from queue

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 66. RedisQueueAdapter - Integration Tests › Job Counts and Metrics › handles getCounts errors

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 67. RedisQueueAdapter - Integration Tests › Connection Management › sets up Redis connection event handlers

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 68. RedisQueueAdapter - Integration Tests › Connection Management › uses environment Redis URL

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 69. RedisQueueAdapter - Integration Tests › Connection Management › falls back to default Redis URL

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 70. RedisQueueAdapter - Integration Tests › Retry Logic and DLQ › sets up retry logic in failed handler

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 71. RedisQueueAdapter - Integration Tests › Retry Logic and DLQ › handles worker setup without errors

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 72. RedisQueueAdapter - Integration Tests › Error Handling › handles queue creation errors gracefully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 73. RedisQueueAdapter - Integration Tests › Error Handling › handles worker creation errors gracefully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 74. RedisQueueAdapter - Integration Tests › Performance Tests › handles multiple concurrent enqueue operations

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 75. RedisQueueAdapter - Integration Tests › Performance Tests › handles rapid subscription setup

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 76. RedisQueueAdapter - Integration Tests › Integration Scenarios › supports full job lifecycle

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 77. RedisQueueAdapter - Integration Tests › Dead Letter Queue (DLQ) Operations › lists DLQ jobs

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 78. RedisQueueAdapter - Integration Tests › Dead Letter Queue (DLQ) Operations › rehydrates DLQ jobs back to processing queue

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 79. RedisQueueAdapter - Integration Tests › Dead Letter Queue (DLQ) Operations › handles rehydration with fewer jobs than limit

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 80. RedisQueueAdapter - Integration Tests › Dead Letter Queue (DLQ) Operations › resets retry attempt counter during rehydration

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 81. RedisQueueAdapter - Integration Tests › Retry and Backoff Logic › handles failed job with retry logic

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 82. RedisQueueAdapter - Integration Tests › Retry and Backoff Logic › moves job to DLQ after max retries

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 83. RedisQueueAdapter - Integration Tests › Retry and Backoff Logic › handles retry with exponential backoff

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 84. RedisQueueAdapter - Integration Tests › Metrics and Observability › updates gauges after enqueue

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 85. RedisQueueAdapter - Integration Tests › Metrics and Observability › calculates oldest job age in queue

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 86. RedisQueueAdapter - Integration Tests › Metrics and Observability › handles metrics collection errors gracefully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 87. RedisQueueAdapter - Integration Tests › Edge Cases and Error Scenarios › handles null/undefined job in failed handler

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 88. RedisQueueAdapter - Integration Tests › Edge Cases and Error Scenarios › handles invalid job data format in failed handler

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 89. RedisQueueAdapter - Integration Tests › Edge Cases and Error Scenarios › handles enqueue with priority options

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 90. RedisQueueAdapter - Integration Tests › Edge Cases and Error Scenarios › handles getOldestAgeMs returning null

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 91. RedisQueueAdapter - Integration Tests › Worker Event Lifecycle › handles worker ready event

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 92. RedisQueueAdapter - Integration Tests › Worker Event Lifecycle › handles worker active event

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 93. RedisQueueAdapter - Integration Tests › Worker Event Lifecycle › handles worker completed event

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 94. RedisQueueAdapter - Integration Tests › Provider Metrics Tracking › tracks retry metrics with provider field

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 95. RedisQueueAdapter - Integration Tests › Provider Metrics Tracking › handles non-string provider values

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 96. RedisQueueAdapter - Integration Tests › Provider Metrics Tracking › handles null provider values

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 97. RedisQueueAdapter - Integration Tests › Provider Metrics Tracking › handles metrics tracking errors gracefully

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 98. RedisQueueAdapter - Integration Tests › Connection Event Handlers › logs redis connection events

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 99. RedisQueueAdapter - Integration Tests › Connection Event Handlers › handles redis error events

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 100. RedisQueueAdapter - Integration Tests › Oldest Job Age Metrics › calculates oldest job with valid timestamps

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 101. RedisQueueAdapter - Integration Tests › Oldest Job Age Metrics › handles jobs with non-finite timestamps

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 102. RedisQueueAdapter - Integration Tests › Oldest Job Age Metrics › handles empty waiting queue for age calculation

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 103. RedisQueueAdapter - Integration Tests › Oldest Job Age Metrics › handles getWaiting errors in updateGauges

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 104. RedisQueueAdapter - Integration Tests › Failed Handler Error Scenarios › handles errors in failed handler catch block

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```


## src/lib/store/FileSystemStore/__tests__/RunManagementService.test.ts

### 105. RunManagementService › createRun › creates run with all required fields

```
expect(received).toEqual(expected) // deep equality
- Expected  - 1
+ Received  + 1
@@ -1,8 +1,8 @@
Object {
```

### 106. RunManagementService › createRun › creates run directory

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-uuid-123", "/workspace"
Received: undefined, "/workspace"
Number of calls: 1
104 |       await service.createRun({ goal: 'test' });
```

### 107. RunManagementService › createRun › writes run to correct file path

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-uuid-123", "/workspace"
Received: undefined, "/workspace"
Number of calls: 1
113 |       await service.createRun(plan);
```

### 108. RunManagementService › createRun › generates unique IDs for multiple runs

```
expect(received).toBe(expected) // Object.is equality
Expected: "uuid-1"
Received: undefined
148 |       const run3 = await service.createRun({ goal: 'Run 3' });
149 |
```

### 109. RunManagementService › createRun › uses default projectId when not provided

```
expect(received).toEqual(expected) // deep equality
- Expected  - 2
+ Received  + 6
- ObjectContaining {
-   "id": Any<String>,
```

### 110. RunManagementService › Concurrent Operations › handles concurrent run creation

```
expect(received).toEqual(expected) // deep equality
- Expected  - 3
+ Received  + 3
Array [
-   "uuid-1",
```


## tests/unit/handlers/git_pr.test.ts

### 111. git_pr handler › run › should create PR with inline content

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"base": "main", "branch": StringMatching /feat\/run-/, "files": ["test.txt"], "prUrl": "https://github.com/owner/repo/pull/123"}, "status": "succeeded"}
Received
1
"step-123",
```

### 112. git_pr handler › run › should handle GitHub API errors gracefully

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"base": "main", "branch": StringMatching /feat\/run-/, "files": ["test.txt"], "prUrl": undefined}, "status": "succeeded"}
Received
1
"step-123",
```

### 113. git_pr handler › run › should handle missing GitHub token

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": ObjectContaining {"prUrl": undefined}, "status": "succeeded"}
Received
1
"step-123",
```

### 114. git_pr handler › run › should use custom branch and base

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": ObjectContaining {"base": "develop", "branch": "feature/custom-branch"}, "status": "succeeded"}
Received
1
"step-123",
```

### 115. git_pr handler › run › should handle gate creation errors gracefully

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": ObjectContaining {"branch": Any<String>, "files": ["test.txt"]}, "status": "succeeded"}
Received
1
"step-123",
```

### 116. git_pr handler › run › should handle parseOrigin with unsupported URL format

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": ObjectContaining {"files": ["test.txt"], "prUrl": undefined}, "status": "succeeded"}
Received
1
"step-123",
```


## tests/unit/worker.main.enhanced.test.ts

### 117. Worker Process - Enhanced Integration Tests › Job Processing › processes job successfully

```
TypeError: workerHandler is not a function
124 |       };
125 |
> 126 |       await workerHandler(payload);
|             ^
```

### 118. Worker Process - Enhanced Integration Tests › Job Processing › handles job timeout

```
TypeError: workerHandler is not a function
159 |       };
160 |
> 161 |       const handlerPromise = workerHandler(payload);
|                              ^
```

### 119. Worker Process - Enhanced Integration Tests › Job Processing › handles job failure

```
TypeError: workerHandler is not a function
191 |       };
192 |
> 193 |       await expect(workerHandler(payload)).rejects.toThrow('Processing failed');
|                    ^
```

### 120. Worker Process - Enhanced Integration Tests › Job Processing › tracks retry attempts

```
TypeError: workerHandler is not a function
222 |       };
223 |
> 224 |       await workerHandler(payload);
|             ^
```

### 121. Worker Process - Enhanced Integration Tests › Idempotency Handling › prevents duplicate job execution

```
TypeError: workerHandler is not a function
244 |       };
245 |
> 246 |       await workerHandler(payload);
|             ^
```

### 122. Worker Process - Enhanced Integration Tests › Idempotency Handling › generates idempotency key from step inputs

```
TypeError: workerHandler is not a function
271 |       };
272 |
> 273 |       await workerHandler(payload);
|             ^
```

### 123. Worker Process - Enhanced Integration Tests › Idempotency Handling › cleans up inbox after successful processing

```
TypeError: workerHandler is not a function
294 |       };
295 |
> 296 |       await workerHandler(payload);
|             ^
```

### 124. Worker Process - Enhanced Integration Tests › Idempotency Handling › cleans up inbox after failed processing

```
TypeError: workerHandler is not a function
315 |       };
316 |
> 317 |       await expect(workerHandler(payload)).rejects.toThrow('Test error');
|                    ^
```

### 125. Worker Process - Enhanced Integration Tests › Error Handling › handles inbox check failure gracefully

```
TypeError: workerHandler is not a function
338 |
339 |       // Should continue processing despite inbox error (fallback behavior)
> 340 |       await workerHandler(payload);
|             ^
```

### 126. Worker Process - Enhanced Integration Tests › Error Handling › handles step fetch failure gracefully

```
TypeError: workerHandler is not a function
356 |
357 |       // Should attempt to process despite fetch failure
> 358 |       await workerHandler(payload);
|             ^
```

### 127. Worker Process - Enhanced Integration Tests › Error Handling › handles outbox add failure on success

```
TypeError: workerHandler is not a function
378 |
379 |       // Should not throw even if outbox fails
> 380 |       await expect(workerHandler(payload)).resolves.not.toThrow();
|                    ^
```

### 128. Worker Process - Enhanced Integration Tests › Error Handling › handles inbox cleanup failure

```
TypeError: workerHandler is not a function
398 |
399 |       // Should not throw even if cleanup fails
> 400 |       await expect(workerHandler(payload)).resolves.not.toThrow();
|                    ^
```

### 129. Worker Process - Enhanced Integration Tests › Error Handling › handles non-Error thrown values

```
TypeError: workerHandler is not a function
417 |       };
418 |
> 419 |       await expect(workerHandler(payload)).rejects.toBeTruthy();
|                    ^
```

### 130. Worker Process - Enhanced Integration Tests › Timeout Management › respects custom timeout from environment

```
TypeError: workerHandler is not a function
453 |       };
454 |
> 455 |       const handlerPromise = workerHandler(payload);
|                              ^
```

### 131. Worker Process - Enhanced Integration Tests › Timeout Management › clears timeout on successful completion

```
TypeError: workerHandler is not a function
489 |       };
490 |
> 491 |       await workerHandler(payload);
|             ^
```

### 132. Worker Process - Enhanced Integration Tests › Observability Context › includes runId, stepId, and retryCount in context

```
TypeError: workerHandler is not a function
517 |       };
518 |
> 519 |       await workerHandler(payload);
|             ^
```

### 133. Worker Process - Enhanced Integration Tests › Observability Context › defaults retryCount to 0 for first attempt

```
TypeError: workerHandler is not a function
548 |       };
549 |
> 550 |       await workerHandler(payload);
|             ^
```

### 134. Worker Process - Enhanced Integration Tests › Edge Cases › handles missing step data fields

```
TypeError: workerHandler is not a function
574 |       };
575 |
> 576 |       await expect(workerHandler(payload)).resolves.not.toThrow();
|                    ^
```

### 135. Worker Process - Enhanced Integration Tests › Edge Cases › handles null step data

```
TypeError: workerHandler is not a function
589 |       };
590 |
> 591 |       await expect(workerHandler(payload)).resolves.not.toThrow();
|                    ^
```

### 136. Worker Process - Enhanced Integration Tests › Edge Cases › handles invalid __attempt values

```
TypeError: workerHandler is not a function
608 |       };
609 |
> 610 |       await expect(workerHandler(payload)).resolves.not.toThrow();
|                    ^
```

### 137. Worker Process - Enhanced Integration Tests › Edge Cases › handles negative __attempt values

```
TypeError: workerHandler is not a function
629 |       };
630 |
> 631 |       await workerHandler(payload);
|             ^
```


## src/lib/store/FileSystemStore/__tests__/StepManagementService.test.ts

### 138. StepManagementService › createStep › creates step with all required fields

```
expect(received).toEqual(expected) // deep equality
- Expected  - 1
+ Received  + 1
@@ -1,9 +1,9 @@
Object {
```

### 139. StepManagementService › createStep › writes step to correct file path

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-789", "step-uuid-123", "/workspace"
Received: "run-789", undefined, "/workspace"
Number of calls: 1
154 |       await service.createStep('run-789', 'Test Step', 'tool', { key: 'value' });
```

### 140. StepManagementService › createStep › generates unique IDs for multiple steps

```
expect(received).toBe(expected) // Object.is equality
Expected: "uuid-1"
Received: undefined
174 |       const step3 = await service.createStep('run-1', 'Step 3', 'tool');
175 |
```

### 141. StepManagementService › Concurrent Operations › handles concurrent step creation

```
expect(received).toEqual(expected) // deep equality
- Expected  - 3
+ Received  + 3
Array [
-   "uuid-1",
```


## tests/unit/handlers/workspace_write.test.ts

### 142. workspace_write handler › run - error handling › should fail with invalid source specification edge case

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"error": StringContaining "Invalid source specification"}, "status": "failed"}
Received
1
"step-123",
```


## src/lib/__tests__/runRecovery.test.ts

### 143. runRecovery › retryStep › Successful Retry › retries failed step successfully

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 144. runRecovery › retryStep › Successful Retry › retries timed_out step

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 145. runRecovery › retryStep › Successful Retry › retries cancelled step

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 146. runRecovery › retryStep › Successful Retry › handles idempotency key cleanup

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 147. runRecovery › retryStep › Successful Retry › executes all operations atomically

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 148. runRecovery › retryStep › Error Cases › throws StepNotRetryableError for queued step

```
expect(received).rejects.toThrow(expected)
Expected constructor: StepNotRetryableError
Received constructor: StepNotFoundError
Received message: "step_not_found"
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
```

### 149. runRecovery › retryStep › Error Cases › throws StepNotRetryableError for running step

```
expect(received).rejects.toThrow(expected)
Expected constructor: StepNotRetryableError
Received constructor: StepNotFoundError
Received message: "step_not_found"
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
```

### 150. runRecovery › retryStep › Error Cases › throws StepNotRetryableError for completed step

```
expect(received).rejects.toThrow(expected)
Expected constructor: StepNotRetryableError
Received constructor: StepNotFoundError
Received message: "step_not_found"
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
```

### 151. runRecovery › retryStep › Error Cases › handles case-insensitive status checking

```
expect(received).resolves.not.toThrow()
Received promise rejected instead of resolved
Rejected to value: [Error: step_not_found]
326 |         mockStore.getStep.mockResolvedValue(step);
327 |
```

### 152. runRecovery › retryStep › Idempotency Key Computation › generates natural idempotency key from inputs

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 153. runRecovery › retryStep › Idempotency Key Computation › handles empty inputs for idempotency key

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 154. runRecovery › retryStep › Idempotency Key Computation › handles null inputs for idempotency key

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 155. runRecovery › retryStep › Event Recording › records step.retry event with previous status

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 156. runRecovery › retryStep › Event Recording › records run.resumed event

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 157. runRecovery › retryStep › Queue Integration › enqueues step with attempt counter

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 158. runRecovery › retryStep › Queue Integration › uses correct topic for queueing

```
step_not_found
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
> 29 |     throw new StepNotFoundError();
|           ^
```

### 159. runRecovery › retryStep › Transaction Rollback › rolls back on error during retry

```
expect(received).rejects.toThrow(expected)
Expected substring: "Database error"
Received message:   "step_not_found"
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
28 |   if (!step || String(step.run_id) !== runId) {
```

### 160. runRecovery › retryStep › Edge Cases › handles step with undefined status

```
expect(received).rejects.toThrow(expected)
Expected constructor: StepNotRetryableError
Received constructor: StepNotFoundError
Received message: "step_not_found"
27 |   const step = await store.getStep(stepId) as StepRow | undefined;
```

### 161. runRecovery › retryStep › Edge Cases › handles very long step names in idempotency key

```
expect(received).resolves.not.toThrow()
Received promise rejected instead of resolved
Rejected to value: [Error: step_not_found]
569 |         mockStore.getStep.mockResolvedValue(step);
570 |
```

### 162. runRecovery › retryStep › Edge Cases › handles complex nested inputs in idempotency key

```
expect(received).resolves.not.toThrow()
Received promise rejected instead of resolved
Rejected to value: [Error: step_not_found]
598 |         mockStore.getStep.mockResolvedValue(step);
599 |
```


## src/lib/store/FileSystemStore/__tests__/EventManagementService.test.ts

### 163. EventManagementService › recordEvent › records event with all required fields

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "/workspace/runs/run-123/events/event-uuid-123.json", ObjectContaining {"created_at": "2024-01-15T12:00:00.000Z", "id": "event-uuid-123", "payload": {"stepName": "Execute Test", "tool": "test_runner"}, "run_id": "run-123", "type": "step.started"}
Received: "/workspace/runs/run-123/events/undefined.json", {"created_at": "2024-01-15T12:00:00.000Z", "id": undefined, "payload": {"stepName": "Execute Test", "tool": "test_runner"}, "run_id": "run-123", "type": "step.started"}
Number of calls: 1
78 |       await service.recordEvent(runId, type, payload);
```

### 164. EventManagementService › recordEvent › generates unique IDs for multiple events

```
expect(received).toMatchObject(expected)
- Expected  - 1
+ Received  + 1
Object {
-   "id": "uuid-1",
```


## tests/api/runs.test.ts

### 165. Runs API Endpoints › POST /api/runs/[id]/steps/[stepId]/retry › should retry a step

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-123", "step-123"
Number of calls: 0
510 |       expect(response.status).toBe(202);
511 |       expect(response.json).toEqual({ ok: true });
```

### 166. Runs API Endpoints › POST /api/runs/[id]/steps/[stepId]/retry › should require authentication

```
expect(received).toBe(expected) // Object.is equality
Expected: 401
Received: 202
527 |       authModule.isAdmin = jest.fn().mockReturnValue(true);
528 |
```

### 167. Runs API Endpoints › POST /api/runs/[id]/steps/[stepId]/retry › should handle step not found error

```
expect(received).toBe(expected) // Object.is equality
Expected: 404
Received: 202
544 |       });
545 |
```

### 168. Runs API Endpoints › POST /api/runs/[id]/steps/[stepId]/retry › should handle retry errors

```
expect(received).toBe(expected) // Object.is equality
Expected: 500
Received: 202
562 |       });
563 |
```

### 169. Runs API Endpoints › POST /api/runs/[id]/steps/[stepId]/retry › should handle non-Error exceptions in retry

```
expect(received).toBe(expected) // Object.is equality
Expected: 500
Received: 202
580 |       });
581 |
```


## src/lib/__tests__/db.test.ts

### 170. db › query › logs successful query execution

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: {"latencyMs": 50, "status": "ok"}, "db.query"
Number of calls: 0
126 |       await query('SELECT * FROM users');
127 |
```

### 171. db › query › records query metrics

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: {"op": "query"}, 50
Number of calls: 0
137 |       await query('SELECT * FROM users');
138 |
```

### 172. db › query › handles query errors

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: {"err": [Error: Connection failed], "latencyMs": 50, "status": "error"}, "db.query.error"
Number of calls: 0
149 |       await expect(query('SELECT * FROM users')).rejects.toThrow('Connection failed');
150 |
```

### 173. db › query › records metrics even on error

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: {"op": "query"}, 50
Number of calls: 0
160 |       await expect(query('SELECT * FROM users')).rejects.toThrow();
161 |
```

### 174. db › withTransaction › rolls back on error

```
expect(received).rejects.toThrow()
Received promise resolved instead of rejected
Resolved to value: undefined
260 |         .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
261 |
```

### 175. db › withTransaction › handles rollback errors gracefully

```
expect(received).rejects.toThrow()
Received promise resolved instead of rejected
Resolved to value: undefined
278 |         .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails
279 |
```

### 176. db › withTransaction › releases client even if commit fails

```
expect(received).rejects.toThrow()
Received promise resolved instead of rejected
Resolved to value: undefined
319 |         .mockRejectedValueOnce(new Error('Commit failed')); // COMMIT fails
320 |
```

### 177. db › Performance › measures query latency

```
expect(jest.fn()).toHaveBeenCalled()
Expected number of calls: >= 1
Received number of calls:    0
510 |
511 |       // Should have logged with latency measurement
```

### 178. db › Performance › tracks query metrics

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: {"op": "query"}, Any<Number>
Number of calls: 0
520 |
521 |       // Verify metrics are being tracked
```


## tests/unit/teams-routes-simple.test.ts

### 179. Teams Routes › GET /teams › should list user teams successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 180. Teams Routes › GET /teams › should handle database error

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 181. Teams Routes › GET /teams › should handle service unavailable

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 182. Teams Routes › POST /teams › should create team successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 183. Teams Routes › POST /teams › should validate request body

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 184. Teams Routes › POST /teams › should handle team creation error

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 185. Teams Routes › GET /teams/:teamId › should get team details successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 186. Teams Routes › GET /teams/:teamId › should handle team not found error

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 187. Teams Routes › PATCH /teams/:teamId › should update team successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 188. Teams Routes › PATCH /teams/:teamId › should validate update data

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 189. Teams Routes › DELETE /teams/:teamId › should delete team successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 190. Teams Routes › DELETE /teams/:teamId › should handle deletion error

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 191. Teams Routes › POST /teams/:teamId/invites › should send invite successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 192. Teams Routes › POST /teams/:teamId/invites › should validate invite data

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 193. Teams Routes › POST /teams/:teamId/invites › should prevent inviting existing members

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 194. Teams Routes › POST /teams/accept-invite › should accept invite successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 195. Teams Routes › POST /teams/accept-invite › should reject invalid token

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 196. Teams Routes › POST /teams/accept-invite › should reject expired invite

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 197. Teams Routes › DELETE /teams/:teamId/invites/:inviteId › should cancel invite successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 198. Teams Routes › PATCH /teams/:teamId/members/:memberId › should update member role successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 199. Teams Routes › PATCH /teams/:teamId/members/:memberId › should prevent role change of team owner

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 200. Teams Routes › DELETE /teams/:teamId/members/:memberId › should remove member successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 201. Teams Routes › DELETE /teams/:teamId/members/:memberId › should prevent removal of team owner

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 202. Teams Routes › POST /teams/:teamId/leave › should allow member to leave team

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 203. Teams Routes › POST /teams/:teamId/leave › should prevent owner from leaving team

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 204. Teams Routes › POST /teams/:teamId/transfer-ownership › should transfer ownership successfully

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 205. Teams Routes › POST /teams/:teamId/transfer-ownership › should validate new owner exists

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 206. Teams Routes › POST /teams/:teamId/transfer-ownership › should validate request body

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 207. Teams Routes › Validation Schemas › should validate team name length

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 208. Teams Routes › Validation Schemas › should validate email format

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```

### 209. Teams Routes › Validation Schemas › should validate member roles

```
Route.get() requires a callback function but got a [object Undefined]
24 |   app.get('/teams', requireAuth, handleListTeams);
25 |   app.post('/teams', requireAuth, handleCreateTeam);
> 26 |   app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
|       ^
```


## src/lib/__tests__/events.test.ts

### 210. Events Module › recordEvent - Database Driver › records event with transaction wrapper

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 211. Events Module › recordEvent - Database Driver › records event without stepId

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 212. Events Module › recordEvent - Database Driver › records event with empty payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 213. Events Module › recordEvent - Database Driver › sanitizes payload using toJsonValue

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 214. Events Module › recordEvent - Database Driver › wraps both operations in transaction

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 215. Events Module › recordEvent - Database Driver › propagates errors from recordEvent

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 216. Events Module › recordEvent - Database Driver › propagates errors from outboxAdd

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 217. Events Module › recordEvent - Database Driver › rolls back transaction on error

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 218. Events Module › recordEvent - File System Driver › records event without transaction wrapper

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 219. Events Module › recordEvent - File System Driver › attempts outboxAdd but ignores errors

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 220. Events Module › recordEvent - File System Driver › records event successfully with FS driver

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 221. Events Module › recordEvent - File System Driver › propagates recordEvent errors even in FS mode

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 222. Events Module › recordEvent - File System Driver › handles outbox error silently in FS mode

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 223. Events Module › Payload Sanitization › handles null payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 224. Events Module › Payload Sanitization › handles undefined payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 225. Events Module › Payload Sanitization › handles array payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 226. Events Module › Payload Sanitization › handles string payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 227. Events Module › Payload Sanitization › handles number payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 228. Events Module › Payload Sanitization › handles boolean payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 229. Events Module › Payload Sanitization › handles deeply nested payload

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 230. Events Module › StepId Handling › includes stepId when provided

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 231. Events Module › StepId Handling › sets stepId to null when not provided

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 232. Events Module › StepId Handling › handles empty string stepId

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 233. Events Module › Integration Scenarios › handles typical run lifecycle events

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 234. Events Module › Integration Scenarios › handles mixed driver scenarios

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 235. Events Module › Integration Scenarios › handles high-volume event recording

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 236. Events Module › Error Recovery › recovers from transient errors

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 237. Events Module › Error Recovery › maintains consistency on partial failure

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 238. Events Module › Performance Tests › handles concurrent event recording

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```

### 239. Events Module › Performance Tests › handles large payloads

```
TypeError: Cannot set property withTransaction of #<Object> which has only a getter
31 |     mockedStore.recordEvent = jest.fn().mockResolvedValue(undefined);
32 |     mockedStore.outboxAdd = jest.fn().mockResolvedValue(undefined);
> 33 |     mockedDb.withTransaction = jest.fn().mockImplementation(async (fn: any) => {
|                             ^
```


## src/lib/store/FileSystemStore/__tests__/ArtifactManagementService.test.ts

### 240. ArtifactManagementService › createArtifact › creates artifact with all required fields

```
expect(received).toEqual(expected) // deep equality
- Expected  - 1
+ Received  + 1
@@ -1,8 +1,8 @@
Object {
```

### 241. ArtifactManagementService › createArtifact › writes artifact to correct file path

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-789", "artifact-uuid-123", "/workspace"
Received: "run-789", undefined, "/workspace"
Number of calls: 1
97 |       await service.createArtifact(runId, 'step-1', 'artifact.json', 'json', artifactData);
```

### 242. ArtifactManagementService › createArtifact › generates unique IDs for multiple artifacts

```
expect(received).toBe(expected) // Object.is equality
Expected: "uuid-1"
Received: undefined
158 |       const result3 = await service.createArtifact('run-1', 'step-1', 'art3', 'file', {});
159 |
```

### 243. ArtifactManagementService › Concurrent Operations › handles concurrent artifact creation

```
expect(received).toEqual(expected) // deep equality
- Expected  - 3
+ Received  + 3
Array [
-   "uuid-1",
```


## tests/unit/worker.main.test.ts

### 244. Worker Main Entry Point Tests › initialization › initializes worker components

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step.ready", Any<Function>
Number of calls: 0
106 |       require('../../src/worker/main');
107 |
```

### 245. Worker Main Entry Point Tests › step processing › processes step successfully

```
TypeError: subscribedHandler is not a function
131 |       };
132 |
> 133 |       await subscribedHandler(payload);
|             ^
```

### 246. Worker Main Entry Point Tests › step processing › handles step execution error

```
TypeError: subscribedHandler is not a function
155 |       };
156 |
> 157 |       await expect(subscribedHandler(payload)).rejects.toThrow('Step failed');
|                    ^
```

### 247. Worker Main Entry Point Tests › step processing › handles step timeout

```
TypeError: subscribedHandler is not a function
175 |       };
176 |
> 177 |       await expect(subscribedHandler(payload)).rejects.toThrow('step timeout');
|                    ^
```

### 248. Worker Main Entry Point Tests › step processing › handles step timeout with race condition

```
TypeError: subscribedHandler is not a function
199 |       };
200 |
> 201 |       const promise = subscribedHandler(payload);
|                       ^
```

### 249. Worker Main Entry Point Tests › idempotency handling › uses provided idempotency key

```
TypeError: subscribedHandler is not a function
277 |       runStep.mockResolvedValue(undefined);
278 |
> 279 |       await subscribedHandler(payload);
|             ^
```

### 250. Worker Main Entry Point Tests › idempotency handling › generates idempotency key from step data

```
TypeError: subscribedHandler is not a function
298 |       runStep.mockResolvedValue(undefined);
299 |
> 300 |       await subscribedHandler(payload);
|             ^
```

### 251. Worker Main Entry Point Tests › idempotency handling › handles duplicate idempotency key

```
TypeError: subscribedHandler is not a function
316 |       mockStore.inboxMarkIfNew.mockResolvedValue(false);
317 |
> 318 |       await subscribedHandler(payload);
|             ^
```

### 252. Worker Main Entry Point Tests › idempotency handling › handles inbox errors gracefully

```
TypeError: subscribedHandler is not a function
337 |
338 |       // Should continue processing despite inbox error
> 339 |       await subscribedHandler(payload);
|             ^
```

### 253. Worker Main Entry Point Tests › idempotency handling › cleans up idempotency key on error

```
TypeError: subscribedHandler is not a function
353 |       runStep.mockRejectedValue(new Error('Processing failed'));
354 |
> 355 |       await expect(subscribedHandler(payload)).rejects.toThrow('Processing failed');
|                    ^
```

### 254. Worker Main Entry Point Tests › retry count handling › calculates retry count from attempt

```
TypeError: subscribedHandler is not a function
372 |       };
373 |
> 374 |       await subscribedHandler(payload);
|             ^
```

### 255. Worker Main Entry Point Tests › retry count handling › handles missing attempt number

```
TypeError: subscribedHandler is not a function
386 |       };
387 |
> 388 |       await subscribedHandler(payload);
|             ^
```

### 256. Worker Main Entry Point Tests › retry count handling › handles invalid attempt number

```
TypeError: subscribedHandler is not a function
401 |       };
402 |
> 403 |       await subscribedHandler(payload);
|             ^
```

### 257. Worker Main Entry Point Tests › error handling in outbox operations › handles outbox success write failure gracefully

```
TypeError: subscribedHandler is not a function
427 |
428 |       // Should not throw despite outbox error
> 429 |       await subscribedHandler(payload);
|             ^
```

### 258. Worker Main Entry Point Tests › error handling in outbox operations › handles outbox failure write failure gracefully

```
TypeError: subscribedHandler is not a function
442 |       mockStore.outboxAdd.mockRejectedValue(new Error('Outbox write failed'));
443 |
> 444 |       await expect(subscribedHandler(payload)).rejects.toThrow('Step failed');
|                    ^
```


## tests/performance/queue-performance.test.ts

### 259. Queue Performance Tests › Throughput Performance › achieves high enqueue throughput (>5000 msg/sec)

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 260. Queue Performance Tests › Throughput Performance › maintains performance under sustained load

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 261. Queue Performance Tests › Throughput Performance › handles burst traffic efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 262. Queue Performance Tests › Latency Performance › achieves low enqueue latency (<1ms P95)

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 263. Queue Performance Tests › Latency Performance › achieves low getCounts latency (<10ms P99)

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 264. Queue Performance Tests › Concurrency and Scalability › handles concurrent enqueue operations

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 265. Queue Performance Tests › Concurrency and Scalability › scales worker subscriptions efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 266. Queue Performance Tests › Concurrency and Scalability › handles queue reuse efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 267. Queue Performance Tests › Memory and Resource Efficiency › handles large payloads efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 268. Queue Performance Tests › Memory and Resource Efficiency › efficiently manages multiple queue instances

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 269. Queue Performance Tests › DLQ Performance › lists DLQ jobs efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 270. Queue Performance Tests › DLQ Performance › rehydrates DLQ jobs efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 271. Queue Performance Tests › Metrics Collection Performance › updates metrics without impacting throughput

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 272. Queue Performance Tests › Error Handling Performance › handles failed enqueues efficiently

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 273. Queue Performance Tests › Performance Degradation Tests › maintains performance with queue depth

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```

### 274. Queue Performance Tests › Real-World Simulation › simulates realistic mixed workload

```
TypeError: this.connection.on is not a function
98 |
99 |   constructor() {
> 100 |     this.connection.on('connect', () => log.info('redis.connect'));
|                     ^
```


## tests/unit/worker.runner.test.ts

### 275. Console

```
console.log
runAtomically calls: 1
console.log
updateStep calls: 0
console.log
```

### 276. Worker Runner Tests › runStep › successfully executes a step

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "status": "succeeded"}
Number of calls: 0
140 |         }
141 |       });
```

### 277. Worker Runner Tests › runStep › enforces tool policy - tool not allowed

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"error": "policy: tool not allowed", "tool": "test:echo", "toolsAllowed": ["bash"]}, "status": "failed"}
Number of calls: 0
217 |       await runStep('run-456', 'step-123');
218 |
```

### 278. Worker Runner Tests › runStep › handles handler execution error

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "status": "failed"}
Number of calls: 0
281 |       await expect(runStep('run-456', 'step-123')).rejects.toThrow('Handler failed');
282 |
```

### 279. Worker Runner Tests › runStep › completes run when no remaining steps

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-456", {"ended_at": Any<String>, "status": "succeeded"}
Number of calls: 0
306 |       await runStep('run-456', 'step-123');
307 |
```

### 280. Worker Runner Tests › markStepTimedOut › marks step as timed out

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", ObjectContaining {"ended_at": Any<String>, "outputs": ObjectContaining {"error": "timeout", "timeoutMs": 30000}, "status": "timed_out"}
Number of calls: 0
404 |       await markStepTimedOut('run-456', 'step-123', 30000);
405 |
```

### 281. Worker Runner Tests › markStepTimedOut › records timeout event

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-456", "step.timeout", {"stepId": "step-123", "timeoutMs": 30000}, "step-123"
Number of calls: 0
417 |       await markStepTimedOut('run-456', 'step-123', 30000);
418 |
```

### 282. Worker Runner Tests › markStepTimedOut › marks run as failed due to timeout

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "run-456", {"ended_at": Any<String>, "status": "failed"}
Number of calls: 0
426 |       await markStepTimedOut('run-456', 'step-123', 30000);
427 |
```

### 283. Worker Runner Tests › markStepTimedOut › handles null/undefined outputs

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"error": "timeout", "timeoutMs": 30000}, "status": "timed_out"}
Number of calls: 0
466 |       await markStepTimedOut('run-456', 'step-123', 30000);
467 |
```

### 284. Worker Runner Tests › markStepTimedOut › handles array outputs

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: "step-123", {"ended_at": Any<String>, "outputs": {"error": "timeout", "timeoutMs": 30000}, "status": "timed_out"}
Number of calls: 0
481 |       await markStepTimedOut('run-456', 'step-123', 30000);
482 |
```

