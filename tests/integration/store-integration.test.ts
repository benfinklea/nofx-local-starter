import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { store } from '../../src/lib/store';

/**
 * Integration tests for the store module
 * These tests use real filesystem operations in temporary directories
 * to validate the actual behavior without mocking
 */

describe('Store Integration Tests', () => {
  let tempDir: string;
  let originalDataDriver: string | undefined;
  let originalQueueDriver: string | undefined;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-test-'));

    // Save original env vars
    originalDataDriver = process.env.DATA_DRIVER;
    originalQueueDriver = process.env.QUEUE_DRIVER;

    // Set up test environment
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
    process.env.ROOT = tempDir;
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Restore original env vars
    if (originalDataDriver !== undefined) {
      process.env.DATA_DRIVER = originalDataDriver;
    } else {
      delete process.env.DATA_DRIVER;
    }

    if (originalQueueDriver !== undefined) {
      process.env.QUEUE_DRIVER = originalQueueDriver;
    } else {
      delete process.env.QUEUE_DRIVER;
    }
  });

  describe('Run Lifecycle', () => {
    it('should create, read, update, and list runs', async () => {
      // Create a run using the actual API
      const plan = { goal: 'Test Goal', steps: [] };
      const run = await store.createRun(plan, 'test-project');

      expect(run.id).toBeDefined();
      expect(run.status).toBe('queued');
      expect(run.projectId).toBe('test-project');

      // Read the run
      const retrieved = await store.getRun(run.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(run.id);
      expect(retrieved?.status).toBe('queued');

      // Update the run
      await store.updateRun(run.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      const updated = await store.getRun(run.id);
      expect(updated?.status).toBe('running');
      expect(updated?.started_at).toBeDefined();

      // List runs
      const runs = await store.listRuns();
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const ourRun = runs.find(r => r.id === run.id);
      expect(ourRun).toBeDefined();
    });

    it('should handle multiple runs with proper sorting', async () => {
      // Create multiple runs with different timestamps
      await store.createRun({
        id: 'run-1',
        status: 'queued',
        projectId: 'project-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      await store.createRun({
        id: 'run-2',
        status: 'running',
        projectId: 'project-1',
        created_at: '2023-01-02T00:00:00Z'
      });

      await store.createRun({
        id: 'run-3',
        status: 'completed',
        projectId: 'project-1',
        created_at: '2023-01-03T00:00:00Z'
      });

      // List should return most recent first
      const runs = await store.listRuns();
      expect(runs.length).toBe(3);
      expect(runs[0].id).toBe('run-3'); // Most recent
      expect(runs[2].id).toBe('run-1'); // Oldest
    });

    it('should reset run status and timestamps', async () => {
      const runData = {
        id: 'reset-test',
        status: 'completed' as const,
        projectId: 'test-project',
        created_at: '2023-01-01T00:00:00Z',
        started_at: '2023-01-01T01:00:00Z',
        ended_at: '2023-01-01T02:00:00Z',
        completed_at: '2023-01-01T02:00:00Z'
      };

      await store.createRun(runData);
      await store.resetRun('reset-test');

      const reset = await store.getRun('reset-test');
      expect(reset?.status).toBe('queued');
      expect(reset?.ended_at).toBeNull();
      expect(reset?.completed_at).toBeNull();
      expect(reset?.started_at).toBeNull();
    });
  });

  describe('Step Operations', () => {
    beforeEach(async () => {
      // Create a parent run for step tests
      await store.createRun({
        id: 'run-for-steps',
        status: 'running',
        projectId: 'test-project',
        created_at: new Date().toISOString()
      });
    });

    it('should create and retrieve steps', async () => {
      const step = await store.createStep({
        id: 'step-1',
        run_id: 'run-for-steps',
        name: 'Test Step',
        tool: 'test-tool',
        inputs: { param: 'value' },
        status: 'queued',
        created_at: new Date().toISOString()
      });

      expect(step.id).toBe('step-1');
      expect(step.name).toBe('Test Step');

      const retrieved = await store.getStep('step-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Step');
    });

    it('should handle idempotency keys', async () => {
      const stepData = {
        id: 'step-idem',
        run_id: 'run-for-steps',
        name: 'Idempotent Step',
        tool: 'test-tool',
        inputs: { param: 'value' },
        status: 'queued' as const,
        idempotency_key: 'unique-key-123',
        created_at: new Date().toISOString()
      };

      const step1 = await store.createStep(stepData);

      // Try to create again with same idempotency key (different ID)
      const step2 = await store.createStep({
        ...stepData,
        id: 'step-idem-2'
      });

      // Should return the same step
      expect(step1.id).toBe(step2.id);
    });

    it('should update step status and outputs', async () => {
      await store.createStep({
        id: 'step-update',
        run_id: 'run-for-steps',
        name: 'Update Test',
        tool: 'test-tool',
        inputs: {},
        status: 'queued',
        created_at: new Date().toISOString()
      });

      await store.updateStep('step-update', {
        status: 'running',
        started_at: new Date().toISOString()
      });

      let step = await store.getStep('step-update');
      expect(step?.status).toBe('running');
      expect(step?.started_at).toBeDefined();

      await store.updateStep('step-update', {
        status: 'completed',
        outputs: { result: 'success' },
        ended_at: new Date().toISOString()
      });

      step = await store.getStep('step-update');
      expect(step?.status).toBe('completed');
      expect(step?.outputs).toEqual({ result: 'success' });
    });

    it('should list steps by run', async () => {
      await store.createStep({
        id: 'step-1',
        run_id: 'run-for-steps',
        name: 'Step 1',
        tool: 'tool-1',
        inputs: {},
        status: 'queued',
        created_at: '2023-01-01T00:00:00Z'
      });

      await store.createStep({
        id: 'step-2',
        run_id: 'run-for-steps',
        name: 'Step 2',
        tool: 'tool-2',
        inputs: {},
        status: 'queued',
        created_at: '2023-01-01T01:00:00Z'
      });

      const steps = await store.listStepsByRun('run-for-steps');
      expect(steps.length).toBe(2);
      expect(steps[0].id).toBe('step-1'); // Sorted by created_at
      expect(steps[1].id).toBe('step-2');
    });

    it('should count remaining steps', async () => {
      await store.createStep({
        id: 'step-c1',
        run_id: 'run-for-steps',
        name: 'Completed',
        tool: 'tool',
        inputs: {},
        status: 'completed',
        created_at: new Date().toISOString()
      });

      await store.createStep({
        id: 'step-p1',
        run_id: 'run-for-steps',
        name: 'Pending',
        tool: 'tool',
        inputs: {},
        status: 'queued',
        created_at: new Date().toISOString()
      });

      await store.createStep({
        id: 'step-p2',
        run_id: 'run-for-steps',
        name: 'Running',
        tool: 'tool',
        inputs: {},
        status: 'running',
        created_at: new Date().toISOString()
      });

      const remaining = await store.countRemainingSteps('run-for-steps');
      expect(remaining).toBe(2); // queued + running
    });

    it('should reset step status', async () => {
      await store.createStep({
        id: 'step-reset',
        run_id: 'run-for-steps',
        name: 'Reset Test',
        tool: 'tool',
        inputs: {},
        status: 'failed',
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      });

      await store.resetStep('step-reset');

      const step = await store.getStep('step-reset');
      expect(step?.status).toBe('queued');
      expect(step?.started_at).toBeNull();
      expect(step?.ended_at).toBeNull();
    });
  });

  describe('Event Operations', () => {
    beforeEach(async () => {
      await store.createRun({
        id: 'run-for-events',
        status: 'running',
        projectId: 'test-project',
        created_at: new Date().toISOString()
      });
    });

    it('should record and list events', async () => {
      await store.recordEvent('run-for-events', 'step.started', {
        step_id: 'step-1',
        timestamp: new Date().toISOString()
      }, 'step-1');

      await store.recordEvent('run-for-events', 'step.completed', {
        step_id: 'step-1',
        result: 'success'
      }, 'step-1');

      const events = await store.listEvents('run-for-events');
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('step.started'); // Sorted by created_at
      expect(events[1].type).toBe('step.completed');
    });
  });

  describe('Gate Operations', () => {
    beforeEach(async () => {
      await store.createRun({
        id: 'run-for-gates',
        status: 'running',
        projectId: 'test-project',
        created_at: new Date().toISOString()
      });

      await store.createStep({
        id: 'step-for-gate',
        run_id: 'run-for-gates',
        name: 'Gated Step',
        tool: 'tool',
        inputs: {},
        status: 'waiting',
        created_at: new Date().toISOString()
      });
    });

    it('should create and retrieve gates', async () => {
      const gate = await store.createOrGetGate('run-for-gates', 'step-for-gate', 'approval');
      expect(gate).toBeDefined();
      expect(gate?.gate_type).toBe('approval');
      expect(gate?.step_id).toBe('step-for-gate');

      // Getting again should return the same gate
      const sameGate = await store.createOrGetGate('run-for-gates', 'step-for-gate', 'approval');
      expect(sameGate?.id).toBe(gate?.id);
    });

    it('should update gate with approval info', async () => {
      const gate = await store.createOrGetGate('run-for-gates', 'step-for-gate', 'approval');

      await store.updateGate(gate!.id, {
        run_id: 'run-for-gates',
        approved: true,
        approved_by: 'user@example.com',
        approved_at: new Date().toISOString()
      });

      const updated = await store.getLatestGate('run-for-gates', 'step-for-gate');
      expect(updated?.approved).toBe(true);
      expect(updated?.approved_by).toBe('user@example.com');
    });

    it('should list gates by run', async () => {
      await store.createOrGetGate('run-for-gates', 'step-for-gate', 'approval');
      await store.createOrGetGate('run-for-gates', 'step-for-gate', 'security');

      const gates = await store.listGatesByRun('run-for-gates');
      expect(gates.length).toBe(2);
    });
  });

  describe('Artifact Operations', () => {
    beforeEach(async () => {
      await store.createRun({
        id: 'run-for-artifacts',
        status: 'running',
        projectId: 'test-project',
        created_at: new Date().toISOString()
      });

      await store.createStep({
        id: 'step-for-artifact',
        run_id: 'run-for-artifacts',
        name: 'Artifact Step',
        tool: 'tool',
        inputs: {},
        status: 'running',
        created_at: new Date().toISOString()
      });
    });

    it('should add and list artifacts', async () => {
      await store.addArtifact('step-for-artifact', 'log', '/path/to/log.txt');
      await store.addArtifact('step-for-artifact', 'report', '/path/to/report.pdf');

      const artifacts = await store.listArtifactsByRun('run-for-artifacts');
      expect(artifacts.length).toBe(2);
      expect(artifacts[0].type).toBe('log');
      expect(artifacts[0].step_name).toBe('Artifact Step');
    });
  });

  describe('Inbox/Outbox Operations', () => {
    it('should handle inbox deduplication', async () => {
      const result1 = await store.inboxMarkSeen('key-1');
      expect(result1).toBe(true); // New key

      const result2 = await store.inboxMarkSeen('key-1');
      expect(result2).toBe(false); // Duplicate key

      await store.inboxDeleteKey('key-1');

      const result3 = await store.inboxMarkSeen('key-1');
      expect(result3).toBe(true); // Key deleted, so new again
    });

    it('should handle outbox message lifecycle', async () => {
      await store.outboxAdd('webhook.trigger', {
        url: 'https://example.com/webhook',
        payload: { event: 'test' }
      });

      const unsent = await store.outboxListUnsent();
      expect(unsent.length).toBe(1);
      expect(unsent[0].topic).toBe('webhook.trigger');

      await store.outboxMarkSent(unsent[0].id);

      const stillUnsent = await store.outboxListUnsent();
      expect(stillUnsent.length).toBe(0);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle a complete run workflow', async () => {
      // 1. Create a run
      const run = await store.createRun({
        id: 'workflow-run',
        status: 'queued',
        projectId: 'workflow-project',
        plan: {
          goal: 'Complete workflow test',
          steps: [
            { name: 'Step 1', tool: 'tool-1' },
            { name: 'Step 2', tool: 'tool-2' }
          ]
        },
        created_at: new Date().toISOString()
      });

      // 2. Start the run
      await store.updateRun(run.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      // 3. Create first step
      const step1 = await store.createStep({
        id: 'wf-step-1',
        run_id: run.id,
        name: 'Step 1',
        tool: 'tool-1',
        inputs: { data: 'input' },
        status: 'queued',
        created_at: new Date().toISOString()
      });

      // 4. Execute step
      await store.updateStep(step1.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      await store.recordEvent(run.id, 'step.started', { step_id: step1.id }, step1.id);

      // 5. Complete step with artifact
      await store.updateStep(step1.id, {
        status: 'completed',
        outputs: { result: 'success' },
        ended_at: new Date().toISOString()
      });

      await store.addArtifact(step1.id, 'log', '/tmp/step1.log');

      // 6. Create gated step
      const step2 = await store.createStep({
        id: 'wf-step-2',
        run_id: run.id,
        name: 'Step 2 (Gated)',
        tool: 'tool-2',
        inputs: {},
        status: 'waiting',
        created_at: new Date().toISOString()
      });

      const gate = await store.createOrGetGate(run.id, step2.id, 'approval');

      // 7. Approve gate
      await store.updateGate(gate!.id, {
        run_id: run.id,
        approved: true,
        approved_by: 'admin@example.com',
        approved_at: new Date().toISOString()
      });

      await store.updateStep(step2.id, { status: 'running' });

      // 8. Complete run
      await store.updateStep(step2.id, {
        status: 'completed',
        ended_at: new Date().toISOString()
      });

      await store.updateRun(run.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      });

      // 9. Verify final state
      const finalRun = await store.getRun(run.id);
      expect(finalRun?.status).toBe('completed');

      const steps = await store.listStepsByRun(run.id);
      expect(steps.length).toBe(2);
      expect(steps.every(s => s.status === 'completed')).toBe(true);

      const events = await store.listEvents(run.id);
      expect(events.length).toBeGreaterThan(0);

      const artifacts = await store.listArtifactsByRun(run.id);
      expect(artifacts.length).toBe(1);

      const remaining = await store.countRemainingSteps(run.id);
      expect(remaining).toBe(0);
    });
  });
});
