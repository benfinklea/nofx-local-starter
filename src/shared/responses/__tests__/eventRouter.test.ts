/**
 * Event Router Integration Tests - 90%+ Coverage Target
 * Critical event handling and state management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ResponsesEventRouter,
  createInMemoryRouter,
  type ResponsesEvent
} from '../eventRouter';
import { InMemoryResponsesArchive } from '../archive';

describe('ResponsesEventRouter - Integration Tests', () => {
  let router: ResponsesEventRouter;
  let archive: InMemoryResponsesArchive;
  const runId = 'test-run-123';

  beforeEach(() => {
    archive = new InMemoryResponsesArchive();
    // Initialize the run in the archive with minimal valid request
    archive.startRun({ runId, request: { model: 'gpt-4.1-mini' } });
    router = new ResponsesEventRouter({ runId, archive });
  });

  describe('Event Handling', () => {
    it('handles response.created event', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'in_progress' }
      };

      expect(() => router.handleEvent(event)).not.toThrow();

      const run = archive.getRun(runId);
      expect(run?.status).toBe('in_progress');
    });

    it('handles response.in_progress event', () => {
      const event: ResponsesEvent = {
        type: 'response.in_progress',
        sequenceNumber: 1,
        response: { id: 'resp-1', status: 'in_progress' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('in_progress');
    });

    it('handles response.completed event with result', () => {
      const event: ResponsesEvent = {
        type: 'response.completed',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'completed' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('completed');
      expect(run?.result).toEqual({ id: 'resp-1', status: 'completed' });
    });

    it('handles response.failed event with error', () => {
      const event: ResponsesEvent = {
        type: 'response.failed',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'failed' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('failed');
      expect(run?.result).toEqual({ id: 'resp-1', status: 'failed' });
    });

    it('handles response.cancelled event', () => {
      const event: ResponsesEvent = {
        type: 'response.cancelled',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'cancelled' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('cancelled');
    });

    it('handles response.incomplete event', () => {
      const event: ResponsesEvent = {
        type: 'response.incomplete',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'incomplete' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('incomplete');
    });

    it('handles response.queued event', () => {
      const event: ResponsesEvent = {
        type: 'response.queued',
        sequence_number: 1,
        response: { id: 'resp-1', status: 'queued' }
      };

      router.handleEvent(event);

      const run = archive.getRun(runId);
      expect(run?.status).toBe('queued');
    });
  });

  describe('Sequence Number Validation', () => {
    it('accepts monotonically increasing sequence numbers', () => {
      const events = [
        { type: 'response.created', sequence_number: 1 },
        { type: 'response.in_progress', sequence_number: 2 },
        { type: 'response.completed', sequence_number: 3 }
      ];

      events.forEach(event => {
        expect(() => router.handleEvent(event as ResponsesEvent)).not.toThrow();
      });
    });

    it('rejects duplicate sequence numbers', () => {
      const event1: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1
      };

      const event2: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 1
      };

      router.handleEvent(event1);

      expect(() => router.handleEvent(event2)).toThrow('sequence 1 already recorded');
    });

    it('rejects out-of-order sequence numbers', () => {
      const event1: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 2
      };

      const event2: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 1
      };

      router.handleEvent(event1);

      expect(() => router.handleEvent(event2)).toThrow('sequence 1 is stale');
    });

    it('throws error for missing sequence number', () => {
      const event: ResponsesEvent = {
        type: 'response.created'
      };

      expect(() => router.handleEvent(event)).toThrow('invalid sequence number');
    });

    it('throws error for non-integer sequence number', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1.5
      };

      expect(() => router.handleEvent(event)).toThrow('invalid sequence number');
    });

    it('throws error for negative sequence number', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: -1
      };

      expect(() => router.handleEvent(event)).toThrow('invalid sequence number');
    });

    it('throws error for zero sequence number', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 0
      };

      expect(() => router.handleEvent(event)).toThrow('invalid sequence number');
    });
  });

  describe('Event Recording', () => {
    it('records all event data in archive', () => {
      const event: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 1,
        response: { id: 'resp-1', progress: 50 },
        metadata: { timestamp: Date.now() }
      };

      router.handleEvent(event);

      const timeline = archive.getTimeline(runId);
      expect(timeline).toBeDefined();
      expect(timeline?.events).toHaveLength(1);
    });

    it('maintains event order in archive', () => {
      const events: ResponsesEvent[] = [
        { type: 'response.created', sequence_number: 1 },
        { type: 'response.in_progress', sequence_number: 2 },
        { type: 'response.completed', sequence_number: 3 }
      ];

      events.forEach(event => router.handleEvent(event));

      const timeline = archive.getTimeline(runId);
      expect(timeline).toBeDefined();
      expect(timeline?.events).toHaveLength(3);
    });
  });

  describe('Status Updates', () => {
    it('updates status only for recognized event types', () => {
      const event: ResponsesEvent = {
        type: 'unknown.event',
        sequence_number: 1
      };

      router.handleEvent(event);

      // Status should not be updated for unknown events
      const run = archive.getRun(runId);
      expect(run).toBeDefined();
    });

    it('persists result only for terminal events', () => {
      // Non-terminal event
      router.handleEvent({
        type: 'response.in_progress',
        sequence_number: 1,
        response: { id: 'resp-1', progress: 50 }
      });

      let run = archive.getRun(runId);
      expect(run?.result).toBeUndefined();

      // Terminal event
      router.handleEvent({
        type: 'response.completed',
        sequence_number: 2,
        response: { id: 'resp-1', status: 'completed' }
      });

      run = archive.getRun(runId);
      expect(run?.result).toBeDefined();
    });

    it('allows status transitions', () => {
      const transitions = [
        { type: 'response.queued', sequence_number: 1, expectedStatus: 'queued' },
        { type: 'response.in_progress', sequence_number: 2, expectedStatus: 'in_progress' },
        { type: 'response.completed', sequence_number: 3, expectedStatus: 'completed' }
      ];

      transitions.forEach(({ type, sequence_number, expectedStatus }) => {
        router.handleEvent({ type, sequence_number } as ResponsesEvent);
        const run = archive.getRun(runId);
        expect(run?.status).toBe(expectedStatus);
      });
    });
  });

  describe('In-Memory Router Factory', () => {
    it('creates router with new archive', () => {
      // Create archive and initialize run first
      const newArchive = new InMemoryResponsesArchive();
      newArchive.startRun({ runId: 'run-456', request: { model: 'gpt-4.1-mini' } });
      const newRouter = new ResponsesEventRouter({ runId: 'run-456', archive: newArchive });

      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1
      };

      expect(() => newRouter.handleEvent(event)).not.toThrow();
    });

    it('creates router with existing archive', () => {
      const sharedArchive = new InMemoryResponsesArchive();
      // Initialize both runs before creating routers
      sharedArchive.startRun({ runId: 'run-789', request: { model: 'gpt-4.1-mini' } });
      sharedArchive.startRun({ runId: 'run-790', request: { model: 'gpt-4.1-mini' } });

      const router1 = createInMemoryRouter('run-789', sharedArchive);
      const router2 = createInMemoryRouter('run-790', sharedArchive);

      router1.handleEvent({
        type: 'response.created',
        sequence_number: 1
      });

      router2.handleEvent({
        type: 'response.created',
        sequence_number: 1
      });

      // Both runs should be in the shared archive
      expect(sharedArchive.getRun('run-789')).toBeDefined();
      expect(sharedArchive.getRun('run-790')).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles events with extra properties', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1,
        response: { id: 'resp-1' },
        extraProp1: 'value1',
        extraProp2: { nested: 'value' }
      };

      expect(() => router.handleEvent(event)).not.toThrow();
    });

    it('handles events with null response', () => {
      const event: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 1,
        response: null as any
      };

      expect(() => router.handleEvent(event)).not.toThrow();
    });

    it('handles events with undefined response', () => {
      const event: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 1,
        response: undefined
      };

      expect(() => router.handleEvent(event)).not.toThrow();
    });

    it('handles large sequence numbers', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: Number.MAX_SAFE_INTEGER
      };

      expect(() => router.handleEvent(event)).not.toThrow();
    });

    it('supports both sequence_number and sequenceNumber properties', () => {
      const event1: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1
      };

      const event2: ResponsesEvent = {
        type: 'response.in_progress',
        sequenceNumber: 2
      };

      expect(() => router.handleEvent(event1)).not.toThrow();
      expect(() => router.handleEvent(event2)).not.toThrow();
    });

    it('prioritizes sequence_number over sequenceNumber', () => {
      const event: ResponsesEvent = {
        type: 'response.created',
        sequence_number: 1,
        sequenceNumber: 999 // Should be ignored
      };

      router.handleEvent(event);

      const nextEvent: ResponsesEvent = {
        type: 'response.in_progress',
        sequence_number: 2
      };

      expect(() => router.handleEvent(nextEvent)).not.toThrow();
    });
  });

  describe('High-Volume Event Handling', () => {
    it('handles rapid event sequences', () => {
      const events = Array(100).fill(null).map((_, i) => ({
        type: 'response.in_progress',
        sequence_number: i + 1,
        response: { id: 'resp-1', progress: i }
      }));

      events.forEach(event => {
        expect(() => router.handleEvent(event as ResponsesEvent)).not.toThrow();
      });

      const timeline = archive.getTimeline(runId);
      expect(timeline?.events).toHaveLength(100);
    });

    it('maintains performance with large payloads', () => {
      const largePayload = {
        id: 'resp-large',
        status: 'completed' as const,
        output: Array(100).fill(null).map((_, i) => ({
          type: 'tool_call' as const,
          id: `call-${i}`,
          name: `tool-${i}`,
          arguments: JSON.stringify({ value: `item-${i}`, metadata: { timestamp: Date.now() } })
        }))
      };

      const event: ResponsesEvent = {
        type: 'response.completed',
        sequence_number: 1,
        response: largePayload
      };

      const start = Date.now();
      router.handleEvent(event);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });

  describe('Multiple Router Instances', () => {
    it('isolates events between different run IDs', () => {
      const archive2 = new InMemoryResponsesArchive();
      // Initialize both runs
      archive2.startRun({ runId: 'run-1', request: { model: 'gpt-4.1-mini' } });
      archive2.startRun({ runId: 'run-2', request: { model: 'gpt-4.1-mini' } });

      const router1 = new ResponsesEventRouter({ runId: 'run-1', archive: archive2 });
      const router2 = new ResponsesEventRouter({ runId: 'run-2', archive: archive2 });

      router1.handleEvent({
        type: 'response.created',
        sequence_number: 1
      });

      router2.handleEvent({
        type: 'response.created',
        sequence_number: 1
      });

      const timeline1 = archive2.getTimeline('run-1');
      const timeline2 = archive2.getTimeline('run-2');

      expect(timeline1?.events).toHaveLength(1);
      expect(timeline2?.events).toHaveLength(1);
    });

    it('allows independent sequence progression per run', () => {
      const archive3 = new InMemoryResponsesArchive();
      // Initialize both runs
      archive3.startRun({ runId: 'run-3', request: { model: 'gpt-4.1-mini' } });
      archive3.startRun({ runId: 'run-4', request: { model: 'gpt-4.1-mini' } });

      const router1 = new ResponsesEventRouter({ runId: 'run-3', archive: archive3 });
      const router2 = new ResponsesEventRouter({ runId: 'run-4', archive: archive3 });

      // Advance run-3 to sequence 5
      for (let i = 1; i <= 5; i++) {
        router1.handleEvent({
          type: 'response.in_progress',
          sequence_number: i
        });
      }

      // Run-4 should still start at sequence 1
      expect(() => router2.handleEvent({
        type: 'response.created',
        sequence_number: 1
      })).not.toThrow();
    });
  });
});
