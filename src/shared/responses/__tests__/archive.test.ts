/**
 * Comprehensive test suite for src/shared/responses/archive.ts
 * Tests in-memory archive functionality before refactoring
 */

import {
  InMemoryResponsesArchive,
  applyRollbackToTimeline,
  type RunRecord,
  type EventRecord,
  type DelegationRecord,
  type ModeratorNote,
  type SafetySnapshot,
  type TimelineSnapshot,
  type RollbackOptions,
} from '../archive';

describe('InMemoryResponsesArchive Tests', () => {
  let archive: InMemoryResponsesArchive;

  beforeEach(() => {
    archive = new InMemoryResponsesArchive();
  });

  describe('Constructor', () => {
    it('should initialize with empty state', () => {
      expect(archive.listRuns()).toEqual([]);
    });
  });

  describe('Run Management', () => {
    it('should start a new run', () => {
      const input = {
        runId: 'test-run-1',
        request: {
          model: 'gpt-4',
          input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
        },
        conversationId: 'conv-1',
        metadata: { source: 'test' },
        traceId: 'trace-123',
      };

      const run = archive.startRun(input);

      expect(run).toBeDefined();
      expect(run.runId).toBe('test-run-1');
      expect(run.request).toEqual(input.request);
      expect(run.conversationId).toBe('conv-1');
      expect(run.metadata).toEqual({ source: 'test' });
      expect(run.status).toBe('queued');
      expect(run.traceId).toBe('trace-123');
      expect(run.createdAt).toBeInstanceOf(Date);
      expect(run.updatedAt).toBeInstanceOf(Date);
      expect(run.safety).toEqual({
        hashedIdentifier: undefined,
        refusalCount: 0,
        lastRefusalAt: undefined,
        moderatorNotes: [],
      });
      expect(run.delegations).toEqual([]);
    });

    it('should start run with safety information', () => {
      const safetyInfo = {
        hashedIdentifier: 'hash123',
        refusalCount: 2,
        lastRefusalAt: new Date(),
        moderatorNotes: [{
          reviewer: 'reviewer1',
          note: 'Test note',
          disposition: 'approved' as const,
          recordedAt: new Date(),
        }],
      };

      const input = {
        runId: 'test-run-2',
        request: { model: 'gpt-4', input: [] },
        safety: safetyInfo,
      };

      const run = archive.startRun(input);

      expect(run.safety).toEqual({
        hashedIdentifier: 'hash123',
        refusalCount: 2,
        lastRefusalAt: safetyInfo.lastRefusalAt,
        moderatorNotes: [safetyInfo.moderatorNotes[0]],
      });
    });

    it('should start run with delegations', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
        arguments: { param: 'value' },
        linkedRunId: 'linked-run',
        output: { result: 'success' },
      };

      const input = {
        runId: 'test-run-3',
        request: { input: [], model: 'gpt-4' },
        delegations: [delegation],
      };

      const run = archive.startRun(input);

      expect(run.delegations).toHaveLength(1);
      expect(run.delegations![0]).toEqual({
        ...delegation,
        requestedAt: expect.any(Date),
      });
    });

    it('should throw error when starting run with existing ID', () => {
      const input = {
        runId: 'duplicate-run',
        request: { input: [], model: 'gpt-4' },
      };

      archive.startRun(input);

      expect(() => archive.startRun(input)).toThrow(
        'Cannot start run \'duplicate-run\': run already exists'
      );
    });

    it('should get existing run', () => {
      const input = {
        runId: 'test-run-4',
        request: { input: [], model: 'gpt-4' },
      };

      const created = archive.startRun(input);
      const retrieved = archive.getRun('test-run-4');

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent run', () => {
      const result = archive.getRun('non-existent');
      expect(result).toBeUndefined();
    });

    it('should update run status', () => {
      const input = {
        runId: 'test-run-5',
        request: { input: [], model: 'gpt-4' },
      };

      const created = archive.startRun(input);
      const updated = archive.updateStatus({
        runId: 'test-run-5',
        status: 'completed',
        result: {
          id: 'result-1',
          status: 'completed',
          output: [{
            type: 'message',
            id: 'msg-1',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Response' }]
          }],
        },
      });

      expect(updated.status).toBe('completed');
      expect(updated.result).toBeDefined();
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime());
    });

    it('should throw error when updating non-existent run', () => {
      expect(() => archive.updateStatus({
        runId: 'non-existent',
        status: 'completed',
      })).toThrow('Cannot update status for run \'non-existent\': run not found');
    });

    it('should list runs sorted by creation date', () => {
      const runs = ['run-1', 'run-2', 'run-3'];
      const createdRuns = runs.map((runId, index) => {
        // Add small delay to ensure different timestamps
        const now = new Date(Date.now() + index * 10);
        return archive.startRun({
          runId,
          request: { input: [], model: 'gpt-4' },
        });
      });

      const listed = archive.listRuns();

      expect(listed).toHaveLength(3);
      // Should be sorted by creation date descending (newest first)
      expect(listed[0].runId).toBe('run-3');
      expect(listed[1].runId).toBe('run-2');
      expect(listed[2].runId).toBe('run-1');
    });

    it('should delete run', () => {
      const input = {
        runId: 'test-run-6',
        request: { input: [], model: 'gpt-4' },
      };

      archive.startRun(input);
      expect(archive.getRun('test-run-6')).toBeDefined();

      archive.deleteRun('test-run-6');
      expect(archive.getRun('test-run-6')).toBeUndefined();
    });

    it('should prune runs older than cutoff', () => {
      const oldDate = new Date(Date.now() - 86400000); // 1 day ago
      const recentDate = new Date();

      // Create runs with different timestamps
      const oldRun = archive.startRun({
        runId: 'old-run',
        request: { input: [], model: 'gpt-4' },
      });

      const recentRun = archive.startRun({
        runId: 'recent-run',
        request: { input: [], model: 'gpt-4' },
      });

      // Manually set the updatedAt to simulate old run
      (archive as any).runs.set('old-run', { ...oldRun, updatedAt: oldDate });

      const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
      archive.pruneOlderThan(cutoff);

      expect(archive.getRun('old-run')).toBeUndefined();
      expect(archive.getRun('recent-run')).toBeDefined();
    });
  });

  describe('Event Management', () => {
    beforeEach(() => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });
    });

    it('should record event', () => {
      const event = archive.recordEvent('test-run', {
        type: 'test.event',
        payload: { data: 'test' },
      });

      expect(event).toEqual({
        runId: 'test-run',
        sequence: 1,
        type: 'test.event',
        payload: { data: 'test' },
        occurredAt: expect.any(Date),
      });
    });

    it('should record event with custom sequence', () => {
      const event = archive.recordEvent('test-run', {
        sequence: 5,
        type: 'test.event',
        payload: { data: 'test' },
      });

      expect(event.sequence).toBe(5);
    });

    it('should record event with custom timestamp', () => {
      const customTime = new Date('2023-01-01T00:00:00Z');
      const event = archive.recordEvent('test-run', {
        type: 'test.event',
        payload: { data: 'test' },
        occurredAt: customTime,
      });

      expect(event.occurredAt).toEqual(customTime);
    });

    it('should auto-increment sequence numbers', () => {
      const event1 = archive.recordEvent('test-run', {
        type: 'first.event',
        payload: {},
      });

      const event2 = archive.recordEvent('test-run', {
        type: 'second.event',
        payload: {},
      });

      expect(event1.sequence).toBe(1);
      expect(event2.sequence).toBe(2);
    });

    it('should throw error for duplicate sequence', () => {
      archive.recordEvent('test-run', {
        sequence: 1,
        type: 'first.event',
        payload: {},
      });

      expect(() => archive.recordEvent('test-run', {
        sequence: 1,
        type: 'duplicate.event',
        payload: {},
      })).toThrow('Duplicate sequence number 1 for run \'test-run\'');
    });

    it('should throw error when recording event for non-existent run', () => {
      expect(() => archive.recordEvent('non-existent', {
        type: 'test.event',
        payload: {},
      })).toThrow('Run \'non-existent\' not found');
    });

    it('should get timeline', () => {
      archive.recordEvent('test-run', {
        type: 'first.event',
        payload: { step: 1 },
      });

      archive.recordEvent('test-run', {
        type: 'second.event',
        payload: { step: 2 },
      });

      const timeline = archive.getTimeline('test-run');

      expect(timeline).toBeDefined();
      expect(timeline!.run.runId).toBe('test-run');
      expect(timeline!.events).toHaveLength(2);
      expect(timeline!.events[0].type).toBe('first.event');
      expect(timeline!.events[1].type).toBe('second.event');
    });

    it('should return undefined for non-existent timeline', () => {
      const timeline = archive.getTimeline('non-existent');
      expect(timeline).toBeUndefined();
    });

    it('should get snapshot at sequence', () => {
      archive.recordEvent('test-run', { type: 'event.1', payload: {} });
      archive.recordEvent('test-run', { type: 'event.2', payload: {} });
      archive.recordEvent('test-run', { type: 'event.3', payload: {} });

      const snapshot = archive.snapshotAt('test-run', 2);

      expect(snapshot).toBeDefined();
      expect(snapshot!.events).toHaveLength(2);
      expect(snapshot!.events[0].type).toBe('event.1');
      expect(snapshot!.events[1].type).toBe('event.2');
    });

    it('should return undefined for non-existent snapshot', () => {
      const snapshot = archive.snapshotAt('non-existent', 1);
      expect(snapshot).toBeUndefined();
    });
  });

  describe('Safety Management', () => {
    beforeEach(() => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });
    });

    it('should update safety information', () => {
      const safety = archive.updateSafety('test-run', {
        hashedIdentifier: 'hash123',
      });

      expect(safety).toEqual({
        hashedIdentifier: 'hash123',
        refusalCount: 0,
        lastRefusalAt: undefined,
        moderatorNotes: [],
      });

      const run = archive.getRun('test-run');
      expect(run!.safety).toEqual(safety);
    });

    it('should log refusal', () => {
      const refusalTime = new Date();
      const safety = archive.updateSafety('test-run', {
        refusalLoggedAt: refusalTime,
      });

      expect(safety.refusalCount).toBe(1);
      expect(safety.lastRefusalAt).toEqual(refusalTime);
    });

    it('should increment refusal count on multiple refusals', () => {
      archive.updateSafety('test-run', { refusalLoggedAt: new Date() });
      const safety = archive.updateSafety('test-run', { refusalLoggedAt: new Date() });

      expect(safety.refusalCount).toBe(2);
    });

    it('should throw error when updating safety for non-existent run', () => {
      expect(() => archive.updateSafety('non-existent', {
        hashedIdentifier: 'hash',
      })).toThrow('run non-existent not found');
    });

    it('should add moderator note', () => {
      const noteInput = {
        reviewer: 'test-reviewer',
        note: 'Test moderation note',
        disposition: 'approved' as const,
      };

      const note = archive.addModeratorNote('test-run', noteInput);

      expect(note).toEqual({
        ...noteInput,
        recordedAt: expect.any(Date),
      });

      const run = archive.getRun('test-run');
      expect(run!.safety!.moderatorNotes).toContain(note);
    });

    it('should add moderator note with custom timestamp', () => {
      const customTime = new Date('2023-01-01T00:00:00Z');
      const noteInput = {
        reviewer: 'test-reviewer',
        note: 'Test note',
        disposition: 'escalated' as const,
        recordedAt: customTime,
      };

      const note = archive.addModeratorNote('test-run', noteInput);

      expect(note.recordedAt).toEqual(customTime);
    });

    it('should preserve existing moderator notes when adding new ones', () => {
      const firstNote = archive.addModeratorNote('test-run', {
        reviewer: 'reviewer1',
        note: 'First note',
        disposition: 'approved',
      });

      const secondNote = archive.addModeratorNote('test-run', {
        reviewer: 'reviewer2',
        note: 'Second note',
        disposition: 'blocked',
      });

      const run = archive.getRun('test-run');
      expect(run!.safety!.moderatorNotes).toHaveLength(2);
      expect(run!.safety!.moderatorNotes).toContain(firstNote);
      expect(run!.safety!.moderatorNotes).toContain(secondNote);
    });

    it('should throw error when adding note for non-existent run', () => {
      expect(() => archive.addModeratorNote('non-existent', {
        reviewer: 'reviewer',
        note: 'note',
        disposition: 'approved',
      })).toThrow('run non-existent not found');
    });
  });

  describe('Delegation Management', () => {
    beforeEach(() => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });
    });

    it('should record delegation', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
        arguments: { param: 'value' },
        linkedRunId: 'linked-run',
        output: { result: 'success' },
      };

      const recorded = archive.recordDelegation('test-run', delegation);

      expect(recorded).toEqual({
        ...delegation,
        requestedAt: expect.any(Date),
      });

      const run = archive.getRun('test-run');
      expect(run!.delegations).toContain(recorded);
    });

    it('should update existing delegation', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
      };

      archive.recordDelegation('test-run', delegation);

      const newDelegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'completed',
        output: { result: 'updated' },
      };

      const updated = archive.recordDelegation('test-run', newDelegation);

      expect(updated.status).toBe('completed');
      expect(updated.output).toEqual({ result: 'updated' });

      const run = archive.getRun('test-run');
      expect(run!.delegations).toHaveLength(1);
    });

    it('should update delegation by callId', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
      };

      archive.recordDelegation('test-run', delegation);

      const updated = archive.updateDelegation('test-run', 'call-1', {
        status: 'completed',
        output: { result: 'success' },
      });

      expect(updated.status).toBe('completed');
      expect(updated.output).toEqual({ result: 'success' });
    });

    it('should set completedAt when status is completed', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
      };

      archive.recordDelegation('test-run', delegation);

      const updated = archive.updateDelegation('test-run', 'call-1', {
        status: 'completed',
      });

      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('should handle custom completedAt date', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
      };

      archive.recordDelegation('test-run', delegation);

      const customTime = new Date('2023-01-01T00:00:00Z');
      const updated = archive.updateDelegation('test-run', 'call-1', {
        completedAt: customTime,
      });

      expect(updated.completedAt).toEqual(customTime);
    });

    it('should throw error when updating non-existent delegation', () => {
      expect(() => archive.updateDelegation('test-run', 'non-existent', {
        status: 'completed',
      })).toThrow('Delegation \'non-existent\' not found for run \'test-run\'');
    });

    it('should throw error when recording delegation for non-existent run', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
      };

      expect(() => archive.recordDelegation('non-existent', delegation)).toThrow(
        'run non-existent not found'
      );
    });
  });

  describe('Rollback Operations', () => {
    let sampleRun: RunRecord;
    let sampleEvents: EventRecord[];

    beforeEach(() => {
      sampleRun = archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
        metadata: { source: 'test' },
      });

      // Add some events
      archive.recordEvent('test-run', { type: 'event.1', payload: { step: 1 } });
      archive.recordEvent('test-run', { type: 'event.2', payload: { step: 2 } });
      archive.recordEvent('test-run', { type: 'event.3', payload: { step: 3 } });

      // Update status with result
      archive.updateStatus({
        runId: 'test-run',
        status: 'completed',
        result: {
          id: 'result-2',
          status: 'completed',
          output: [
            {
              type: 'message',
              id: 'msg-2',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'Response 1' }]
            },
            { type: 'tool_call', id: 'call-1', name: 'test-tool' },
          ],
        },
      });

      sampleEvents = archive.getTimeline('test-run')!.events;
    });

    it('should rollback to specific sequence', () => {
      const result = archive.rollback('test-run', { sequence: 2 });

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('event.1');
      expect(result.events[1].type).toBe('event.2');
      expect(result.run.metadata!.last_rollback_sequence).toBe('2');
    });

    it('should rollback specific tool call', () => {
      const result = archive.rollback('test-run', { toolCallId: 'call-1' });

      expect(result.run.result!.output).toHaveLength(1);
      expect(result.run.metadata!.last_rollback_tool_call).toBe('call-1');
    });

    it('should record rollback metadata', () => {
      const options: RollbackOptions = {
        sequence: 1,
        operator: 'test-operator',
        reason: 'test rollback',
      };

      const result = archive.rollback('test-run', options);

      expect(result.run.metadata!.last_rollback_at).toBeDefined();
      expect(result.run.metadata!.last_rollback_sequence).toBe('1');
      expect(result.run.metadata!.last_rollback_operator).toBe('test-operator');
      expect(result.run.metadata!.last_rollback_reason).toBe('test rollback');
    });

    it('should reindex events after rollback', () => {
      // Start with 3 events (sequences 1, 2, 3)
      const result = archive.rollback('test-run', { sequence: 2 });

      // Should have 2 events with sequences 1, 2
      expect(result.events).toHaveLength(2);
      expect(result.events[0].sequence).toBe(1);
      expect(result.events[1].sequence).toBe(2);
    });

    it('should throw error when rolling back non-existent run', () => {
      expect(() => archive.rollback('non-existent', { sequence: 1 })).toThrow(
        'run non-existent not found'
      );
    });
  });

  describe('Utility Functions', () => {
    describe('applyRollbackToTimeline', () => {
      let sampleRun: RunRecord;
      let sampleEvents: EventRecord[];

      beforeEach(() => {
        sampleRun = {
          runId: 'test-run',
          request: { input: [], model: 'gpt-4' },
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { source: 'test' },
          result: {
            id: 'result-3',
            status: 'completed',
            output: [
              {
                type: 'message',
                id: 'msg-1',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'Response' }]
              },
              { type: 'tool_call', id: 'call-1', name: 'test-tool' },
            ],
          },
        };

        sampleEvents = [
          {
            runId: 'test-run',
            sequence: 1,
            type: 'event.1',
            payload: { call_id: 'call-1' },
            occurredAt: new Date(),
          },
          {
            runId: 'test-run',
            sequence: 2,
            type: 'event.2',
            payload: { step: 2 },
            occurredAt: new Date(),
          },
          {
            runId: 'test-run',
            sequence: 3,
            type: 'event.3',
            payload: { callId: 'call-1' },
            occurredAt: new Date(),
          },
        ];
      });

      it('should filter events by sequence', () => {
        const result = applyRollbackToTimeline(sampleRun, sampleEvents, { sequence: 2 });

        expect(result.events).toHaveLength(2);
        expect(result.events[0].sequence).toBe(1);
        expect(result.events[1].sequence).toBe(2);
      });

      it('should filter events by tool call ID', () => {
        const result = applyRollbackToTimeline(sampleRun, sampleEvents, { toolCallId: 'call-1' });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('event.2');
      });

      it('should reindex filtered events', () => {
        const result = applyRollbackToTimeline(sampleRun, sampleEvents, { toolCallId: 'call-1' });

        expect(result.events[0].sequence).toBe(1);
      });

      it('should strip tool call from result', () => {
        const result = applyRollbackToTimeline(sampleRun, sampleEvents, { toolCallId: 'call-1' });

        expect(result.run.result!.output).toHaveLength(1);
        expect(result.run.result!.output![0].type).toBe('message');
      });

      it('should update run metadata', () => {
        const options: RollbackOptions = {
          sequence: 1,
          operator: 'test-operator',
          reason: 'test reason',
          toolCallId: 'call-1',
        };

        const result = applyRollbackToTimeline(sampleRun, sampleEvents, options);

        expect(result.run.metadata!.last_rollback_at).toBeDefined();
        expect(result.run.metadata!.last_rollback_sequence).toBe('1');
        expect(result.run.metadata!.last_rollback_operator).toBe('test-operator');
        expect(result.run.metadata!.last_rollback_reason).toBe('test reason');
        expect(result.run.metadata!.last_rollback_tool_call).toBe('call-1');
      });

      it('should preserve original metadata', () => {
        const result = applyRollbackToTimeline(sampleRun, sampleEvents, { sequence: 1 });

        expect(result.run.metadata!.source).toBe('test');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request data', () => {
      expect(() => archive.startRun({
        runId: 'invalid-run',
        request: { invalid: 'data' } as any,
      })).toThrow();
    });

    it('should handle invalid result data in updateStatus', () => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });

      expect(() => archive.updateStatus({
        runId: 'test-run',
        status: 'completed',
        result: { invalid: 'result' } as any,
      })).toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should clone delegations to prevent external mutation', () => {
      const delegation: DelegationRecord = {
        callId: 'call-1',
        toolName: 'test-tool',
        requestedAt: new Date(),
        status: 'requested',
        arguments: { param: 'value' },
      };

      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });

      const recorded = archive.recordDelegation('test-run', delegation);

      // Modify original delegation
      delegation.status = 'completed';
      delegation.arguments = { param: 'modified' };

      // Recorded delegation should not be affected
      expect(recorded.status).toBe('requested');
      expect(recorded.arguments).toEqual({ param: 'value' });
    });

    it('should clone events in timeline to prevent external mutation', () => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });

      archive.recordEvent('test-run', {
        type: 'test.event',
        payload: { mutable: 'data' },
      });

      const timeline = archive.getTimeline('test-run')!;

      // Modify returned events
      timeline.events[0].payload = { mutable: 'modified' };

      // Get timeline again to verify original is preserved
      const timeline2 = archive.getTimeline('test-run')!;
      expect(timeline2.events[0].payload).toEqual({ mutable: 'data' });
    });

    it('should preserve safety data immutability', () => {
      archive.startRun({
        runId: 'test-run',
        request: { input: [], model: 'gpt-4' },
      });

      const safety = archive.updateSafety('test-run', {
        hashedIdentifier: 'hash123',
      });

      // Modify returned safety object
      safety.refusalCount = 999;
      (safety as any).moderatorNotes.push({ invalid: 'note' });

      // Get run again to verify original is preserved
      const run = archive.getRun('test-run')!;
      expect(run.safety!.refusalCount).toBe(0);
      expect(run.safety!.moderatorNotes).toEqual([]);
    });
  });
});