/**
 * Comprehensive test suite for src/services/responses/runCoordinator.ts
 * Tests run coordinator functionality before refactoring
 */

// @ts-nocheck
import { jest } from '@jest/globals';

// Mock all dependencies
jest.mock('../../../shared/openai/responsesSchemas', () => ({
  validateResponsesRequest: jest.fn().mockImplementation((req) => req),
}));

jest.mock('../../../shared/responses/archive', () => ({
  InMemoryResponsesArchive: jest.fn().mockImplementation(() => ({
    startRun: jest.fn().mockReturnValue({ runId: 'test-run' }),
    getRun: jest.fn().mockReturnValue({ runId: 'test-run', status: 'completed' }),
    getTimeline: jest.fn().mockReturnValue({ run: { runId: 'test-run' }, events: [] }),
    updateSafety: jest.fn(),
  })),
}));

jest.mock('../../../shared/responses/eventRouter', () => ({
  ResponsesEventRouter: jest.fn().mockImplementation(() => ({
    handleEvent: jest.fn(),
  })),
}));

jest.mock('../conversationStateManager', () => ({
  ConversationStateManager: jest.fn().mockImplementation(() => ({
    prepareContext: jest.fn().mockResolvedValue({
      conversation: 'conv-123',
      storeFlag: true,
      previousResponseId: 'prev-123',
    }),
  })),
}));

jest.mock('../rateLimitTracker', () => ({
  RateLimitTracker: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    getLastSnapshot: jest.fn().mockReturnValue({
      requestId: 'req-123',
      observedAt: new Date(),
    }),
  })),
}));

jest.mock('../toolRegistry', () => ({
  ToolRegistry: jest.fn().mockImplementation(() => ({
    buildToolPayload: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../streamBuffer', () => ({
  StreamingBuffer: jest.fn().mockImplementation(() => ({
    handleEvent: jest.fn(),
    getAssistantMessages: jest.fn().mockReturnValue([]),
    getReasoningSummaries: jest.fn().mockReturnValue([]),
    getRefusals: jest.fn().mockReturnValue([]),
    getOutputAudioSegments: jest.fn().mockReturnValue([]),
    getImageArtifacts: jest.fn().mockReturnValue([]),
    getInputAudioTranscripts: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../historyPlanner', () => ({
  HistoryPlanner: jest.fn().mockImplementation(() => ({
    plan: jest.fn().mockReturnValue({ strategy: 'vendor' }),
  })),
}));

jest.mock('../incidentLog', () => ({
  IncidentLog: jest.fn().mockImplementation(() => ({
    recordIncident: jest.fn(),
    resolveIncidentsByRun: jest.fn(),
  })),
}));

jest.mock('../delegationTracker', () => ({
  DelegationTracker: jest.fn().mockImplementation(() => ({
    handleEvent: jest.fn(),
    getDelegations: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn().mockReturnValue({
      startSpan: jest.fn().mockReturnValue({
        spanContext: jest.fn().mockReturnValue({ traceId: 'trace-123' }),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
      }),
    }),
  },
  SpanStatusCode: {
    UNSET: 0,
    ERROR: 2,
  },
}));

describe('ResponsesRunCoordinator Tests', () => {
  let ResponsesRunCoordinator: any;
  let coordinator: any;
  let mockClient: any;
  let mockConversationManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Import the class after mocks are set up
    const module = require('../runCoordinator');
    ResponsesRunCoordinator = module.ResponsesRunCoordinator;

    mockClient = {
      create: jest.fn().mockResolvedValue({
        result: {
          id: 'resp-123',
          status: 'completed',
          output: [
            {
              type: 'message',
              id: 'msg-123',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'Hello' }],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        },
        headers: {
          'x-ratelimit-remaining-requests': '100',
          'x-ratelimit-limit-requests': '1000',
        },
      }),
    };

    mockConversationManager = {
      prepareContext: jest.fn().mockResolvedValue({
        conversation: 'conv-123',
        storeFlag: true,
        previousResponseId: 'prev-123',
      }),
    };

    coordinator = new ResponsesRunCoordinator({
      conversationManager: mockConversationManager,
      client: mockClient,
    });
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with minimal dependencies', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getArchive()).toBeDefined();
    });

    it('should initialize with all dependencies', () => {
      const mockRateLimitTracker = { capture: jest.fn() };
      const mockToolRegistry = { buildToolPayload: jest.fn() };
      const mockHistoryPlanner = { plan: jest.fn() };
      const mockIncidentLog = { recordIncident: jest.fn() };
      const mockDelegationTracker = { handleEvent: jest.fn() };

      const fullCoordinator = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        rateLimitTracker: mockRateLimitTracker,
        toolRegistry: mockToolRegistry,
        historyPlanner: mockHistoryPlanner,
        incidentLog: mockIncidentLog,
        delegationTracker: mockDelegationTracker,
      });

      expect(fullCoordinator).toBeDefined();
    });

    it('should use default InMemoryResponsesArchive when none provided', () => {
      expect(coordinator.getArchive()).toBeDefined();
    });
  });

  describe('Start Run Functionality', () => {
    it('should start a basic run', async () => {
      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: {
          model: 'gpt-4',
          input: [{ type: 'input_text', text: 'Hello' }],
        },
      };

      const result = await coordinator.startRun(options);

      expect(result).toBeDefined();
      expect(result.request).toBeDefined();
      expect(result.context).toBeDefined();
      expect(mockConversationManager.prepareContext).toHaveBeenCalledWith({
        tenantId: options.tenantId,
        runId: options.runId,
        existingConversationId: undefined,
        previousResponseId: undefined,
        policy: undefined,
      });
    });

    it('should start run with history planning', async () => {
      const mockHistoryPlanner = { plan: jest.fn().mockReturnValue({ strategy: 'vendor' }) };
      const coordinatorWithPlanner = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        historyPlanner: mockHistoryPlanner,
      });

      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        history: { messages: [] },
      };

      const result = await coordinatorWithPlanner.startRun(options);

      expect(result.historyPlan).toBeDefined();
      expect(mockHistoryPlanner.plan).toHaveBeenCalledWith(options.history);
    });

    it('should handle background runs', async () => {
      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        background: true,
      };

      const result = await coordinator.startRun(options);

      expect(result).toBeDefined();
      expect(mockClient.create).not.toHaveBeenCalled();
    });

    it('should handle speech options', async () => {
      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        speech: {
          mode: 'server_vad' as const,
          inputFormat: 'wav' as const,
          transcription: { enabled: true, model: 'whisper-1' },
        },
      };

      const result = await coordinator.startRun(options);

      expect(result).toBeDefined();
      expect(result.request.metadata).toEqual(
        expect.objectContaining({
          speech_mode: 'server_vad',
          speech_input_format: 'wav',
          speech_transcription: 'enabled',
          speech_transcription_model: 'whisper-1',
        })
      );
    });

    it('should handle tool configurations', async () => {
      const mockToolRegistry = { buildToolPayload: jest.fn().mockReturnValue(['tool1']) };
      const coordinatorWithTools = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        toolRegistry: mockToolRegistry,
      });

      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        tools: { enabled: ['tool1'] },
      };

      await coordinatorWithTools.startRun(options);

      expect(mockToolRegistry.buildToolPayload).toHaveBeenCalledWith(options.tools);
    });

    it('should merge metadata correctly', async () => {
      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: {
          model: 'gpt-4',
          input: [{ type: 'input_text', text: 'Hello' }],
          metadata: { existing: 'value' },
        },
        metadata: { additional: 'data' },
      };

      const result = await coordinator.startRun(options);

      expect(result.request.metadata).toEqual({
        existing: 'value',
        additional: 'data',
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await coordinator.startRun({
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      });
    });

    it('should handle events for registered run', () => {
      const event = {
        type: 'response.text.delta',
        sequence_number: 1,
        text: 'Hello',
      };

      expect(() => {
        coordinator.handleEvent('test-run-123', event);
      }).not.toThrow();
    });

    it('should throw error for unregistered run', () => {
      const event = { type: 'response.text.delta' };

      expect(() => {
        coordinator.handleEvent('non-existent-run', event);
      }).toThrow('router for run non-existent-run not registered');
    });

    it('should handle terminal events', () => {
      const event = { type: 'response.completed', sequence_number: 1 };

      expect(() => {
        coordinator.handleEvent('test-run-123', event);
      }).not.toThrow();
    });

    it('should handle failed events', () => {
      const event = { type: 'response.failed', sequence_number: 1, error: 'Test error' };

      expect(() => {
        coordinator.handleEvent('test-run-123', event);
      }).not.toThrow();
    });

    it('should process safety hooks for refusal events', () => {
      const event = { type: 'response.refusal.done' };

      expect(() => {
        coordinator.handleEvent('test-run-123', event);
      }).not.toThrow();
    });
  });

  describe('Buffer Management', () => {
    beforeEach(async () => {
      await coordinator.startRun({
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      });
    });

    it('should get buffered messages', () => {
      const messages = coordinator.getBufferedMessages('test-run-123');
      expect(messages).toEqual([]);
    });

    it('should get buffered reasoning', () => {
      const reasoning = coordinator.getBufferedReasoning('test-run-123');
      expect(reasoning).toEqual([]);
    });

    it('should get buffered refusals', () => {
      const refusals = coordinator.getBufferedRefusals('test-run-123');
      expect(refusals).toEqual([]);
    });

    it('should get buffered output audio', () => {
      const audio = coordinator.getBufferedOutputAudio('test-run-123');
      expect(audio).toEqual([]);
    });

    it('should get buffered images', () => {
      const images = coordinator.getBufferedImages('test-run-123');
      expect(images).toEqual([]);
    });

    it('should get buffered input transcripts', () => {
      const transcripts = coordinator.getBufferedInputTranscripts('test-run-123');
      expect(transcripts).toEqual([]);
    });

    it('should return empty arrays for non-existent runs', () => {
      expect(coordinator.getBufferedMessages('non-existent')).toEqual([]);
      expect(coordinator.getBufferedReasoning('non-existent')).toEqual([]);
      expect(coordinator.getBufferedRefusals('non-existent')).toEqual([]);
    });
  });

  describe('Archive Resync', () => {
    it('should resync from archive', () => {
      expect(() => {
        coordinator.resyncFromArchive('test-run-123');
      }).not.toThrow();
    });

    it('should handle missing timeline gracefully', () => {
      const coordinatorWithEmptyArchive = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        archive: {
          getTimeline: jest.fn().mockReturnValue(undefined),
        },
      });

      expect(() => {
        coordinatorWithEmptyArchive.resyncFromArchive('test-run-123');
      }).not.toThrow();
    });

    it('should handle promise-based timeline', async () => {
      const promiseArchive = {
        getTimeline: jest.fn().mockReturnValue(
          Promise.resolve({ run: { runId: 'test' }, events: [] })
        ),
      };

      const coordinatorWithPromiseArchive = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        archive: promiseArchive,
      });

      const result = coordinatorWithPromiseArchive.resyncFromArchive('test-run-123');
      expect(result).toBeInstanceOf(Promise);

      await result;
      expect(promiseArchive.getTimeline).toHaveBeenCalledWith('test-run-123');
    });
  });

  describe('Delegation Management', () => {
    it('should get delegations from tracker', async () => {
      const mockDelegationTracker = {
        getDelegations: jest.fn().mockReturnValue([{ callId: 'call-1' }]),
        handleEvent: jest.fn(),
      };

      const coordinatorWithDelegations = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        delegationTracker: mockDelegationTracker,
      });

      const delegations = coordinatorWithDelegations.getDelegations('test-run-123');
      expect(delegations).toEqual([{ callId: 'call-1' }]);
      expect(mockDelegationTracker.getDelegations).toHaveBeenCalledWith('test-run-123');
    });

    it('should get delegations from archive when no tracker', () => {
      const delegations = coordinator.getDelegations('test-run-123');
      expect(delegations).toEqual([]);
    });

    it('should handle promise-based run records', () => {
      const coordinatorWithPromiseArchive = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        archive: {
          getRun: jest.fn().mockReturnValue(Promise.resolve({ delegations: [] })),
        },
      });

      const delegations = coordinatorWithPromiseArchive.getDelegations('test-run-123');
      expect(delegations).toEqual([]);
    });
  });

  describe('Rate Limit Tracking', () => {
    it('should get last rate limit snapshot', () => {
      const mockRateLimitTracker = {
        getLastSnapshot: jest.fn().mockReturnValue({ requestId: 'req-123' }),
        capture: jest.fn(),
      };

      const coordinatorWithRateLimit = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        rateLimitTracker: mockRateLimitTracker,
      });

      const snapshot = coordinatorWithRateLimit.getLastRateLimitSnapshot('tenant-1');
      expect(snapshot).toEqual({ requestId: 'req-123' });
      expect(mockRateLimitTracker.getLastSnapshot).toHaveBeenCalledWith('tenant-1');
    });

    it('should return undefined when no rate limit tracker', () => {
      const snapshot = coordinator.getLastRateLimitSnapshot('tenant-1');
      expect(snapshot).toBeUndefined();
    });
  });

  describe('Safety Management', () => {
    it('should register safety hash', () => {
      expect(() => {
        coordinator.registerSafetyHash('test-run-123', 'hash-123');
      }).not.toThrow();
    });
  });

  describe('Policy Resolution', () => {
    it('should resolve explicit policy', async () => {
      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        policy: { strategy: 'stateless' as const },
      };

      await coordinator.startRun(options);

      expect(mockConversationManager.prepareContext).toHaveBeenCalledWith(
        expect.objectContaining({
          policy: { strategy: 'stateless' },
        })
      );
    });

    it('should resolve policy from history plan', async () => {
      const mockHistoryPlanner = { plan: jest.fn().mockReturnValue({ strategy: 'vendor' }) };
      const coordinatorWithPlanner = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        historyPlanner: mockHistoryPlanner,
      });

      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
        history: { messages: [] },
      };

      await coordinatorWithPlanner.startRun(options);

      expect(mockConversationManager.prepareContext).toHaveBeenCalledWith(
        expect.objectContaining({
          policy: { strategy: 'vendor' },
        })
      );
    });
  });

  describe('Incident Management', () => {
    it('should record incidents for failed responses', async () => {
      const mockIncidentLog = {
        recordIncident: jest.fn(),
        resolveIncidentsByRun: jest.fn(),
      };

      const coordinatorWithIncidents = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        incidentLog: mockIncidentLog,
      });

      await coordinatorWithIncidents.startRun({
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      });

      coordinatorWithIncidents.handleEvent('test-run-123', {
        type: 'response.failed',
        sequence_number: 1,
        error: 'Test error',
      });

      expect(mockIncidentLog.recordIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-123',
          type: 'failed',
          sequence: 1,
        })
      );
    });

    it('should resolve incidents for completed responses', async () => {
      const mockIncidentLog = {
        recordIncident: jest.fn(),
        resolveIncidentsByRun: jest.fn(),
      };

      const coordinatorWithIncidents = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: mockClient,
        incidentLog: mockIncidentLog,
      });

      await coordinatorWithIncidents.startRun({
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      });

      coordinatorWithIncidents.handleEvent('test-run-123', {
        type: 'response.completed',
        sequence_number: 1,
      });

      expect(mockIncidentLog.resolveIncidentsByRun).toHaveBeenCalledWith('test-run-123', {
        resolvedBy: 'system',
        disposition: 'manual',
        linkedRunId: 'test-run-123',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle client errors gracefully', async () => {
      const errorClient = {
        create: jest.fn().mockRejectedValue(new Error('Client error')),
      };

      const coordinatorWithErrorClient = new ResponsesRunCoordinator({
        conversationManager: mockConversationManager,
        client: errorClient,
      });

      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      };

      await expect(coordinatorWithErrorClient.startRun(options)).rejects.toThrow('Client error');
    });

    it('should handle conversation manager errors', async () => {
      const errorConversationManager = {
        prepareContext: jest.fn().mockRejectedValue(new Error('Context error')),
      };

      const coordinatorWithErrorManager = new ResponsesRunCoordinator({
        conversationManager: errorConversationManager,
        client: mockClient,
      });

      const options = {
        runId: 'test-run-123',
        tenantId: 'tenant-1',
        request: { model: 'gpt-4', input: [{ type: 'input_text', text: 'Hello' }] },
      };

      await expect(coordinatorWithErrorManager.startRun(options)).rejects.toThrow('Context error');
    });
  });

});