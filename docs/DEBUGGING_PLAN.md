# API Execution Pipeline Debugging Plan

## Problem Summary
The NOFX Control Plane API can create runs and start step execution, but steps get stuck in "running" status after LLM calls complete. The API also becomes unstable after handling requests.

## Observed Behavior

### What Works ✅
1. API starts and responds to health checks
2. Runs can be created via POST /runs
3. Worker picks up tasks from queue
4. LLM integration works (Claude 3.5 Sonnet responds)
5. Events are recorded (run.created, step.started, llm.usage)

### What Fails ❌
1. Steps never transition from "running" to "succeeded"
2. No artifacts are created despite LLM generating content
3. API becomes unresponsive after a few requests
4. No step.finished events are recorded

## Test Case That Failed
```json
{
  "plan": {
    "goal": "Generate test documentation",
    "steps": [{
      "name": "generate_hello_world",
      "tool": "codegen",
      "inputs": {
        "prompt": "Write a simple Hello World README.md file",
        "topic": "Test Documentation"
      }
    }]
  }
}
```

Run ID: `c912df12-fc46-4a64-8dde-c0c1a36e12be`

## Root Cause Investigation Plan

### Phase 1: Immediate Diagnostics

1. **Check Worker Logs**
   ```bash
   # Look for errors in the worker process
   # The worker is running but may be swallowing errors
   ps aux | grep worker
   # Check console output or redirect logs
   ```

2. **Verify Storage Configuration**
   ```bash
   # Check if Supabase is running
   supabase status

   # Verify storage bucket exists
   curl http://localhost:54321/storage/v1/bucket/artifacts

   # Check environment variables
   grep SUPABASE .env
   ```

3. **Examine Codegen Handler**
   - File: `src/worker/handlers/codegen.ts`
   - Check for:
     - Error handling after LLM response
     - Artifact creation logic
     - Step status update calls
     - Try/catch blocks that might swallow errors

### Phase 2: Deep Dive Analysis

1. **Database State Check**
   ```sql
   -- Check stuck step details
   SELECT * FROM step WHERE id = 'fa92fb7e-a8d3-404d-98d8-59fa82719398';

   -- Check if outputs were saved
   SELECT outputs FROM step WHERE run_id = 'c912df12-fc46-4a64-8dde-c0c1a36e12be';

   -- Check for artifacts
   SELECT * FROM artifact WHERE run_id = 'c912df12-fc46-4a64-8dde-c0c1a36e12be';
   ```

2. **Handler Execution Flow**
   - Trace through `src/worker/runner.ts` → `runStep()` function
   - Verify the codegen handler's `run()` method completes
   - Check if `ctx.store.updateStepOutput()` is called
   - Verify `ctx.store.createArtifact()` is called

3. **Storage Layer Issues**
   - File: `src/lib/store.ts`
   - Check if storage driver is correctly configured
   - Verify artifact upload logic
   - Check for connection timeouts

### Phase 3: API Stability Issues

1. **Memory Leaks**
   - Check for unclosed database connections
   - Look for event listeners not being cleaned up
   - Verify SSE streams are properly closed

2. **Unhandled Promise Rejections**
   ```javascript
   // Add to main.ts
   process.on('unhandledRejection', (reason, promise) => {
     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
   });
   ```

3. **Error Middleware**
   - Check if Express error middleware is catching all errors
   - Look for synchronous throws in async handlers

## Fix Implementation Plan

### Priority 1: Fix Step Completion (Critical)

1. **Add Comprehensive Logging to Codegen Handler**
   ```typescript
   // In src/worker/handlers/codegen.ts
   export const handler: StepHandler = {
     async run(ctx) {
       console.log(`[CODEGEN] Starting step ${ctx.stepId}`);
       try {
         // Add logging at each stage
         console.log('[CODEGEN] Calling LLM...');
         const response = await routeCompletion(...);
         console.log('[CODEGEN] LLM responded, saving output...');

         // Ensure this is called
         await ctx.store.updateStepOutput(ctx.stepId, response);
         console.log('[CODEGEN] Output saved, creating artifact...');

         // Ensure artifact is created
         const artifact = await ctx.store.createArtifact(...);
         console.log('[CODEGEN] Artifact created:', artifact.id);

         return { success: true, outputs: response };
       } catch (error) {
         console.error('[CODEGEN] Error:', error);
         throw error; // Don't swallow
       }
     }
   };
   ```

2. **Fix Runner Status Updates**
   ```typescript
   // In src/worker/runner.ts
   // Ensure step is marked as finished
   try {
     const result = await handler.run(context);
     // THIS MUST HAPPEN
     await store.updateStepStatus(stepId, 'succeeded');
     await recordEvent(runId, 'step.finished', { status: 'succeeded' });
   } catch (error) {
     await store.updateStepStatus(stepId, 'failed');
     await recordEvent(runId, 'step.finished', { status: 'failed', error });
   }
   ```

### Priority 2: Fix API Stability (High)

1. **Add Global Error Handler**
   ```typescript
   // In src/api/main.ts
   app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
     log.error({ err, path: req.path }, 'Unhandled error');
     res.status(500).json({ error: 'Internal server error' });
   });
   ```

2. **Fix Async Route Handlers**
   ```typescript
   // Wrap all async routes
   const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
     Promise.resolve(fn(req, res, next)).catch(next);
   };

   app.post('/runs', asyncHandler(async (req, res) => {
     // route logic
   }));
   ```

3. **Add Connection Management**
   ```typescript
   // Ensure DB connections are released
   import { pool } from '../lib/db';

   process.on('SIGTERM', async () => {
     await pool.end();
     process.exit(0);
   });
   ```

### Priority 3: Improve Observability (Medium)

1. **Add Debug Endpoints**
   ```typescript
   app.get('/dev/stuck-steps', async (req, res) => {
     const stuck = await query(`
       SELECT * FROM step
       WHERE status = 'running'
       AND started_at < NOW() - INTERVAL '5 minutes'
     `);
     res.json(stuck);
   });
   ```

2. **Add Health Checks for Dependencies**
   ```typescript
   app.get('/health/detailed', async (req, res) => {
     const checks = {
       database: await checkDatabase(),
       redis: await checkRedis(),
       storage: await checkStorage(),
       worker: await checkWorker()
     };
     res.json(checks);
   });
   ```

## Testing Plan

1. **Unit Tests for Handler**
   ```typescript
   // tests/handlers/codegen.test.ts
   it('should update step status after LLM response', async () => {
     // Mock LLM response
     // Verify store.updateStepOutput called
     // Verify artifact created
     // Verify success returned
   });
   ```

2. **Integration Test for Full Pipeline**
   ```typescript
   // tests/e2e/run-completion.test.ts
   it('should complete a codegen run end-to-end', async () => {
     const run = await createRun(codegenPlan);
     await waitForCompletion(run.id, 30000);
     const final = await getRun(run.id);
     expect(final.status).toBe('succeeded');
     expect(final.artifacts).toHaveLength(1);
   });
   ```

3. **Stress Test for API Stability**
   ```bash
   # Create 10 runs in parallel
   for i in {1..10}; do
     curl -X POST http://localhost:3000/runs -d @test-run.json &
   done
   wait
   # Verify API still responds
   curl http://localhost:3000/health
   ```

## Success Criteria

- [ ] Codegen steps complete successfully
- [ ] Artifacts are created and stored
- [ ] Step status transitions to "succeeded"
- [ ] API remains stable under load
- [ ] All events are properly recorded
- [ ] No unhandled errors in logs
- [ ] Integration tests pass consistently

## Rollback Plan

If fixes cause regressions:
1. Revert handler changes
2. Restore original runner.ts
3. Keep logging additions for debugging
4. Document specific failure points

## Notes for AI Coder

1. Start with adding logging - don't change logic initially
2. The issue is likely in the codegen handler or runner, not the API
3. Check for missing `await` keywords - async issues are likely
4. Don't assume Supabase Storage is working - verify it
5. The LLM call works, so focus on what happens AFTER
6. Keep the API running while debugging - use separate terminal for tests

---

*Priority: Fix step completion first, then API stability. The system is close to working - likely just a few missing lines or error handling issues.*