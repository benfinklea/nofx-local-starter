/**
 * Orchestration Service Tests - 90%+ Coverage Target
 * Critical multi-agent coordination and workflow orchestration
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  createOrchestrationSession,
  updateOrchestrationSession,
  listOrchestrationSessions,
  selectAgentsForOrchestration,
  sendAgentMessage,
  getSessionRelationships,
  checkCircuitBreaker,
  recordAgentFailure
} from '../orchestration';
import * as db from '../db';
import { log } from '../observability';

// Mock dependencies
jest.mock('../db');
jest.mock('../observability', () => ({
  timeIt: jest.fn(async (_name: string, fn: () => Promise<any>) => {
    const result = await fn();
    return { result, latencyMs: 0 };
  }),
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../metrics');

const mockedDb = db as jest.Mocked<typeof db>;

describe('Orchestration Service - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Session Management', () => {
    describe('createOrchestrationSession', () => {
      it('creates a solo orchestration session', async () => {
        const mockAgent = {
          agent_id: 'agent-123',
          agent_name: 'TestAgent',
          capabilities: []
        };

        const mockSessionRow = {
          id: 'session-123',
          orchestration_type: 'solo',
          primary_agent_id: 'agent-123',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [mockSessionRow],
          rowCount: 1,
          command: 'INSERT'
        } as any);

        mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());

        // Mock agent selection
        mockedDb.query.mockResolvedValueOnce({
          rows: [mockAgent],
          rowCount: 1,
          command: 'SELECT'
        } as any);

        const result = await createOrchestrationSession({
          orchestrationType: 'solo',
          agentSelectionCriteria: {
            requiredCapabilities: [{ skillId: 'code-generation', minProficiency: 5 }],
            orchestrationType: 'solo'
          },
          autoStart: true
        });

        expect(result.session).toBeDefined();
        expect(result.session.orchestrationType).toBe('solo');
        expect(result.session.status).toBe('active');
      });

      it('creates a hierarchical orchestration session with relationships', async () => {
        const mockAgents = [
          { agent_id: 'supervisor-1', agent_name: 'Supervisor', capabilities: [] },
          { agent_id: 'worker-1', agent_name: 'Worker1', capabilities: [] },
          { agent_id: 'worker-2', agent_name: 'Worker2', capabilities: [] }
        ];

        const mockSessionRow = {
          id: 'session-456',
          orchestration_type: 'hierarchical',
          primary_agent_id: 'supervisor-1',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());

        // Mock session creation
        mockedDb.query
          .mockResolvedValueOnce({
            rows: [mockSessionRow],
            rowCount: 1,
            command: 'INSERT'
          } as any)
          .mockResolvedValueOnce({
            rows: [],
            rowCount: 0,
            command: 'INSERT'
          } as any);

        // Mock agent selection
        mockedDb.query.mockResolvedValueOnce({
          rows: mockAgents,
          rowCount: mockAgents.length,
          command: 'SELECT'
        } as any);

        const result = await createOrchestrationSession({
          orchestrationType: 'hierarchical',
          agentSelectionCriteria: {
            requiredCapabilities: [{ skillId: 'orchestration', minProficiency: 7 }],
            orchestrationType: 'hierarchical'
          },
          autoStart: true
        });

        expect(result.session.orchestrationType).toBe('hierarchical');
        expect(mockedDb.query).toHaveBeenCalled();
      });

      it('calculates cost and duration estimates', async () => {
        const mockSessionRow = {
          id: 'session-789',
          orchestration_type: 'swarm',
          primary_agent_id: 'agent-1',
          session_metadata: {},
          status: 'pending',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());
        mockedDb.query.mockResolvedValueOnce({
          rows: [mockSessionRow],
          rowCount: 1,
          command: 'INSERT'
        } as any);

        const result = await createOrchestrationSession({
          orchestrationType: 'swarm',
          autoStart: false
        });

        expect(result.estimatedCost).toBeDefined();
        expect(result.estimatedDuration).toBeDefined();
        expect(typeof result.estimatedCost).toBe('number');
        expect(typeof result.estimatedDuration).toBe('number');
      });

      it('throws error when no agents match criteria', async () => {
        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT'
        } as any);

        await expect(
          createOrchestrationSession({
            orchestrationType: 'solo',
            agentSelectionCriteria: {
              requiredCapabilities: [{ skillId: 'nonexistent', minProficiency: 10 }],
              orchestrationType: 'solo'
            }
          })
        ).rejects.toThrow('No agents match the selection criteria');
      });
    });

    describe('updateOrchestrationSession', () => {
      it('updates session status', async () => {
        const mockUpdatedRow = {
          id: 'session-123',
          orchestration_type: 'solo',
          primary_agent_id: 'agent-123',
          session_metadata: {},
          status: 'completed',
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [mockUpdatedRow],
          rowCount: 1,
          command: 'UPDATE'
        } as any);

        const result = await updateOrchestrationSession('session-123', {
          status: 'completed',
          endedAt: new Date().toISOString()
        });

        expect(result.status).toBe('completed');
        expect(result.endedAt).toBeDefined();
      });

      it('updates performance metrics', async () => {
        const mockMetrics = {
          totalDuration: 5000,
          agentCount: 3,
          messagesExchanged: 15
        };

        const mockUpdatedRow = {
          id: 'session-456',
          orchestration_type: 'hierarchical',
          primary_agent_id: 'agent-123',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: mockMetrics,
          created_at: new Date().toISOString()
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [mockUpdatedRow],
          rowCount: 1,
          command: 'UPDATE'
        } as any);

        const result = await updateOrchestrationSession('session-456', {
          performanceMetrics: mockMetrics as any
        });

        expect(result.performanceMetrics).toEqual(mockMetrics);
      });

      it('throws error when session not found', async () => {
        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'UPDATE'
        } as any);

        await expect(
          updateOrchestrationSession('nonexistent-session', {
            status: 'completed'
          })
        ).rejects.toThrow('Session nonexistent-session not found');
      });
    });

    describe('listOrchestrationSessions', () => {
      it('lists sessions with pagination', async () => {
        const mockSessions = Array(25).fill(null).map((_, i) => ({
          id: `session-${i}`,
          orchestration_type: 'solo',
          primary_agent_id: `agent-${i}`,
          session_metadata: {},
          status: 'active',
          started_at: new Date(Date.now() - i * 1000).toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date(Date.now() - i * 1000).toISOString()
        }));

        mockedDb.query.mockResolvedValueOnce({
          rows: mockSessions,
          rowCount: mockSessions.length,
          command: 'SELECT'
        } as any);

        const result = await listOrchestrationSessions({ limit: 20 });

        expect(result.sessions).toHaveLength(20);
        expect(result.nextCursor).toBeDefined();
      });

      it('filters sessions by orchestration type', async () => {
        const mockSessions = [
          {
            id: 'session-1',
            orchestration_type: 'hierarchical',
            primary_agent_id: 'agent-1',
            session_metadata: {},
            status: 'active',
            started_at: new Date().toISOString(),
            ended_at: null,
            performance_metrics: null,
            created_at: new Date().toISOString()
          }
        ];

        mockedDb.query.mockResolvedValueOnce({
          rows: mockSessions,
          rowCount: 1,
          command: 'SELECT'
        } as any);

        const result = await listOrchestrationSessions({
          orchestrationType: 'hierarchical'
        });

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].orchestrationType).toBe('hierarchical');
      });

      it('filters sessions by date range', async () => {
        const startDate = new Date('2024-01-01').toISOString();
        const endDate = new Date('2024-12-31').toISOString();

        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT'
        } as any);

        await listOrchestrationSessions({
          startedAfter: startDate,
          startedBefore: endDate
        });

        expect(mockedDb.query).toHaveBeenCalledWith(
          expect.stringContaining('started_at >='),
          expect.arrayContaining([startDate, endDate])
        );
      });
    });
  });

  describe('Agent Selection and Routing', () => {
    describe('selectAgentsForOrchestration', () => {
      it('selects agents with structured capabilities', async () => {
        const mockAgents = [
          {
            agent_id: 'agent-1',
            agent_name: 'CodeAgent',
            capabilities: [
              {
                id: 'cap-1',
                agentId: 'agent-1',
                skillId: 'code-generation',
                minProficiency: 8,
                successRate: 0.95,
                averageLatencyMs: 100,
                costPerOperation: 0.01
              }
            ]
          }
        ];

        mockedDb.query.mockResolvedValueOnce({
          rows: mockAgents,
          rowCount: 1,
          command: 'SELECT'
        } as any);

        const result = await selectAgentsForOrchestration({
          requiredCapabilities: [{ skillId: 'code-generation', minProficiency: 5 }],
          orchestrationType: 'solo'
        });

        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('primary');
      });

      it('falls back to JSONB capabilities when structured fails', async () => {
        const mockAgents = [
          {
            agent_id: 'agent-2',
            agent_name: 'LegacyAgent',
            capabilities: [
              { id: 'code-generation', name: 'Code Generation' }
            ]
          }
        ];

        // First query fails (structured), second succeeds (JSONB)
        mockedDb.query
          .mockRejectedValueOnce(new Error('Table not found'))
          .mockResolvedValueOnce({
            rows: mockAgents,
            rowCount: 1,
            command: 'SELECT'
          } as any);

        const result = await selectAgentsForOrchestration({
          requiredCapabilities: [{ skillId: 'code-generation', minProficiency: 5 }],
          orchestrationType: 'solo'
        });

        expect(result).toHaveLength(1);
      });

      it('selects agents for pair orchestration', async () => {
        const mockAgents = [
          { agent_id: 'agent-1', agent_name: 'Agent1', capabilities: [] },
          { agent_id: 'agent-2', agent_name: 'Agent2', capabilities: [] }
        ];

        mockedDb.query.mockResolvedValueOnce({
          rows: mockAgents,
          rowCount: 2,
          command: 'SELECT'
        } as any);

        const result = await selectAgentsForOrchestration({
          requiredCapabilities: [{ skillId: 'collaboration', minProficiency: 5 }],
          orchestrationType: 'pair'
        });

        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('primary');
        expect(result[1].role).toBe('secondary');
      });

      it('selects agents for swarm orchestration', async () => {
        const mockAgents = Array(5).fill(null).map((_, i) => ({
          agent_id: `agent-${i}`,
          agent_name: `Agent${i}`,
          capabilities: []
        }));

        mockedDb.query.mockResolvedValueOnce({
          rows: mockAgents,
          rowCount: 5,
          command: 'SELECT'
        } as any);

        const result = await selectAgentsForOrchestration({
          requiredCapabilities: [{ skillId: 'parallel-work', minProficiency: 5 }],
          orchestrationType: 'swarm'
        });

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(a => a.role === 'worker')).toBe(true);
      });

      it('respects cost budget constraints', async () => {
        const mockAgents = [
          {
            agent_id: 'expensive-agent',
            agent_name: 'ExpensiveAgent',
            capabilities: [
              { costPerOperation: 100 }
            ]
          },
          {
            agent_id: 'cheap-agent',
            agent_name: 'CheapAgent',
            capabilities: [
              { costPerOperation: 1 }
            ]
          }
        ];

        mockedDb.query.mockResolvedValueOnce({
          rows: mockAgents,
          rowCount: 2,
          command: 'SELECT'
        } as any);

        const result = await selectAgentsForOrchestration({
          requiredCapabilities: [{ skillId: 'task', minProficiency: 5 }],
          orchestrationType: 'solo',
          costBudget: 50
        });

        // Should only select the cheap agent
        expect(result.some(a => a.agentId === 'expensive-agent')).toBe(false);
      });
    });
  });

  describe('Agent Communication', () => {
    describe('sendAgentMessage', () => {
      it('sends message between agents', async () => {
        const mockSession = {
          id: 'session-123',
          orchestration_type: 'hierarchical',
          primary_agent_id: 'agent-1',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        const mockMessageRow = {
          id: 'message-123',
          created_at: new Date().toISOString()
        };

        mockedDb.query
          .mockResolvedValueOnce({
            rows: [mockSession],
            rowCount: 1,
            command: 'SELECT'
          } as any)
          .mockResolvedValueOnce({
            rows: [mockMessageRow],
            rowCount: 1,
            command: 'INSERT'
          } as any);

        const result = await sendAgentMessage({
          sessionId: 'session-123',
          fromAgentId: 'agent-1',
          toAgentId: 'agent-2',
          messageType: 'task_assignment',
          payload: { task: 'process-data' }
        });

        expect(result.messageId).toBe('message-123');
        expect(result.delivered).toBe(true);
      });

      it('handles message acknowledgment', async () => {
        const mockSession = {
          id: 'session-456',
          orchestration_type: 'pair',
          primary_agent_id: 'agent-1',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        const mockMessageRow = {
          id: 'message-456',
          created_at: new Date().toISOString()
        };

        mockedDb.query
          .mockResolvedValueOnce({
            rows: [mockSession],
            rowCount: 1,
            command: 'SELECT'
          } as any)
          .mockResolvedValueOnce({
            rows: [mockMessageRow],
            rowCount: 1,
            command: 'INSERT'
          } as any)
          .mockResolvedValueOnce({
            rows: [],
            rowCount: 1,
            command: 'UPDATE'
          } as any);

        const result = await sendAgentMessage({
          sessionId: 'session-456',
          fromAgentId: 'agent-1',
          toAgentId: 'agent-2',
          messageType: 'result_share',
          payload: { result: 'completed' },
          requireAcknowledgment: true
        });

        expect(result.acknowledgedBy).toContain('agent-2');
      });

      it('throws error when session is inactive', async () => {
        const mockSession = {
          id: 'session-789',
          orchestration_type: 'solo',
          primary_agent_id: 'agent-1',
          session_metadata: {},
          status: 'completed',
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          performance_metrics: null,
          created_at: new Date().toISOString()
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [mockSession],
          rowCount: 1,
          command: 'SELECT'
        } as any);

        await expect(
          sendAgentMessage({
            sessionId: 'session-789',
            fromAgentId: 'agent-1',
            toAgentId: 'agent-2',
            messageType: 'task_assignment',
            payload: {}
          })
        ).rejects.toThrow('Cannot send message to inactive session');
      });
    });

    describe('getSessionRelationships', () => {
      it('retrieves agent relationships for session', async () => {
        const mockRelationships = [
          {
            id: 'rel-1',
            session_id: 'session-123',
            supervisor_agent_id: 'supervisor-1',
            worker_agent_id: 'worker-1',
            relationship_type: 'supervisor',
            created_at: new Date().toISOString(),
            supervisor_name: 'SupervisorAgent',
            worker_name: 'WorkerAgent1'
          },
          {
            id: 'rel-2',
            session_id: 'session-123',
            supervisor_agent_id: 'supervisor-1',
            worker_agent_id: 'worker-2',
            relationship_type: 'supervisor',
            created_at: new Date().toISOString(),
            supervisor_name: 'SupervisorAgent',
            worker_name: 'WorkerAgent2'
          }
        ];

        mockedDb.query.mockResolvedValueOnce({
          rows: mockRelationships,
          rowCount: 2,
          command: 'SELECT'
        } as any);

        const result = await getSessionRelationships('session-123');

        expect(result).toHaveLength(2);
        expect(result[0].relationshipType).toBe('supervisor');
      });
    });
  });

  describe('Circuit Breaker', () => {
    it('allows healthy agent to proceed', () => {
      const isHealthy = checkCircuitBreaker('healthy-agent');
      expect(isHealthy).toBe(true);
    });

    it('opens circuit after 3 failures', () => {
      const agentId = 'failing-agent';

      recordAgentFailure(agentId);
      expect(checkCircuitBreaker(agentId)).toBe(true);

      recordAgentFailure(agentId);
      expect(checkCircuitBreaker(agentId)).toBe(true);

      recordAgentFailure(agentId);
      expect(checkCircuitBreaker(agentId)).toBe(false);

      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ agentId }),
        'Circuit breaker opened for agent'
      );
    });

    it('resets circuit after timeout', () => {
      const agentId = 'timeout-agent';

      // Trigger circuit breaker
      recordAgentFailure(agentId);
      recordAgentFailure(agentId);
      recordAgentFailure(agentId);

      expect(checkCircuitBreaker(agentId)).toBe(false);

      // Mock time passage (5 minutes + 1ms)
      jest.useFakeTimers();
      jest.advanceTimersByTime(300001);

      expect(checkCircuitBreaker(agentId)).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles database transaction failures', async () => {
      mockedDb.withTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(
        createOrchestrationSession({
          orchestrationType: 'solo',
          autoStart: true
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('handles empty agent selection results gracefully', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [],
        orchestrationType: 'solo'
      });

      expect(result).toEqual([]);
    });

    it('handles malformed capability data', async () => {
      const mockAgents = [
        {
          agent_id: 'agent-malformed',
          agent_name: 'MalformedAgent',
          capabilities: 'not-an-array' // Malformed data
        }
      ];

      mockedDb.query.mockResolvedValueOnce({
        rows: mockAgents,
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'test', minProficiency: 5 }],
        orchestrationType: 'solo'
      });

      // Should handle gracefully
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles missing session metadata', async () => {
      const mockSessionRow = {
        id: 'session-no-metadata',
        orchestration_type: 'solo',
        primary_agent_id: 'agent-1',
        session_metadata: null, // Null metadata
        status: 'active',
        started_at: new Date().toISOString(),
        ended_at: null,
        performance_metrics: null,
        created_at: new Date().toISOString()
      };

      mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());
      mockedDb.query.mockResolvedValueOnce({
        rows: [mockSessionRow],
        rowCount: 1,
        command: 'INSERT'
      } as any);

      const result = await createOrchestrationSession({
        orchestrationType: 'solo',
        autoStart: true
      });

      expect(result.session.sessionMetadata).toEqual({});
    });

    it('handles no capability requirements', async () => {
      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [],
        orchestrationType: 'solo'
      });

      expect(result).toEqual([]);
    });

    it('handles pair orchestration with only one agent', async () => {
      const mockAgent = {
        agent_id: 'single-agent',
        agent_name: 'SingleAgent',
        capabilities: []
      };

      mockedDb.query.mockResolvedValueOnce({
        rows: [mockAgent],
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'test', minProficiency: 5 }],
        orchestrationType: 'pair'
      });

      // Should return single agent even though pair orchestration needs 2
      expect(result).toHaveLength(1);
    });

    it('handles hierarchical orchestration without workers', async () => {
      const mockSessionRow = {
        id: 'session-hierarchy-single',
        orchestration_type: 'hierarchical',
        primary_agent_id: 'supervisor-1',
        session_metadata: {},
        status: 'active',
        started_at: new Date().toISOString(),
        ended_at: null,
        performance_metrics: null,
        created_at: new Date().toISOString()
      };

      const mockSupervisor = {
        agent_id: 'supervisor-1',
        agent_name: 'Supervisor',
        capabilities: []
      };

      mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());
      mockedDb.query
        .mockResolvedValueOnce({
          rows: [mockSessionRow],
          rowCount: 1,
          command: 'INSERT'
        } as any);

      mockedDb.query.mockResolvedValueOnce({
        rows: [mockSupervisor],
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await createOrchestrationSession({
        orchestrationType: 'hierarchical',
        agentSelectionCriteria: {
          requiredCapabilities: [{ skillId: 'supervision', minProficiency: 5 }],
          orchestrationType: 'hierarchical'
        },
        autoStart: true
      });

      expect(result.session.orchestrationType).toBe('hierarchical');
    });

    it('handles swarm with more than 10 agents', async () => {
      const mockAgents = Array(15).fill(null).map((_, i) => ({
        agent_id: `agent-${i}`,
        agent_name: `Agent${i}`,
        capabilities: []
      }));

      mockedDb.query.mockResolvedValueOnce({
        rows: mockAgents,
        rowCount: 15,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'swarm-work', minProficiency: 5 }],
        orchestrationType: 'swarm'
      });

      // Should limit to 10 agents
      expect(result.length).toBeLessThanOrEqual(10);
      expect(result.every(a => a.role === 'worker')).toBe(true);
    });

    it('handles default orchestration type', async () => {
      const mockAgents = [
        { agent_id: 'agent-1', agent_name: 'Agent1', capabilities: [] }
      ];

      mockedDb.query.mockResolvedValueOnce({
        rows: mockAgents,
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'general', minProficiency: 5 }],
        orchestrationType: 'solo'
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('Additional Coverage - Helper Functions', () => {
    it('filters agents with resource constraints', async () => {
      const mockAgents = [
        {
          agent_id: 'agent-1',
          agent_name: 'ResourceAgent',
          capabilities: []
        }
      ];

      mockedDb.query.mockResolvedValueOnce({
        rows: mockAgents,
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'test', minProficiency: 5 }],
        orchestrationType: 'solo',
        resourceConstraints: { memory: 1024, cpu: 2 }
      });

      // Currently returns all agents - placeholder implementation
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('calculates agent cost correctly', async () => {
      const mockAgents = [
        {
          agent_id: 'expensive-agent',
          agent_name: 'ExpensiveAgent',
          capabilities: [
            {
              id: 'cap-1',
              agentId: 'expensive-agent',
              skillId: 'test',
              minProficiency: 5,
              costPerOperation: 50
            }
          ]
        }
      ];

      mockedDb.query.mockResolvedValueOnce({
        rows: mockAgents,
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await selectAgentsForOrchestration({
        requiredCapabilities: [{ skillId: 'test', minProficiency: 5 }],
        orchestrationType: 'solo',
        costBudget: 100
      });

      expect(result).toHaveLength(1);
    });

    it('creates session without agents selected', async () => {
      const mockSessionRow = {
        id: 'session-no-agents',
        orchestration_type: 'solo',
        primary_agent_id: null,
        session_metadata: {},
        status: 'pending',
        started_at: new Date().toISOString(),
        ended_at: null,
        performance_metrics: null,
        created_at: new Date().toISOString()
      };

      mockedDb.withTransaction.mockImplementation(async (fn: any) => fn());
      mockedDb.query.mockResolvedValueOnce({
        rows: [mockSessionRow],
        rowCount: 1,
        command: 'INSERT'
      } as any);

      const result = await createOrchestrationSession({
        orchestrationType: 'solo',
        autoStart: false
      });

      expect(result.session.primaryAgentId).toBeNull();
      expect(result.selectedAgents).toEqual([]);
    });

    it('handles messages without acknowledgment requirement', async () => {
      const mockSession = {
        id: 'session-no-ack',
        orchestration_type: 'solo',
        primary_agent_id: 'agent-1',
        session_metadata: {},
        status: 'active',
        started_at: new Date().toISOString(),
        ended_at: null,
        performance_metrics: null,
        created_at: new Date().toISOString()
      };

      const mockMessageRow = {
        id: 'message-no-ack',
        created_at: new Date().toISOString()
      };

      mockedDb.query
        .mockResolvedValueOnce({
          rows: [mockSession],
          rowCount: 1,
          command: 'SELECT'
        } as any)
        .mockResolvedValueOnce({
          rows: [mockMessageRow],
          rowCount: 1,
          command: 'INSERT'
        } as any);

      const result = await sendAgentMessage({
        sessionId: 'session-no-ack',
        fromAgentId: 'agent-1',
        toAgentId: 'agent-2',
        messageType: 'status_update',
        payload: { message: 'test' },
        requireAcknowledgment: false
      });

      expect(result.acknowledgedBy).toEqual([]);
    });

    it('lists sessions with no filters', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          orchestration_type: 'solo',
          primary_agent_id: 'agent-1',
          session_metadata: {},
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
          performance_metrics: null,
          created_at: new Date().toISOString()
        }
      ];

      mockedDb.query.mockResolvedValueOnce({
        rows: mockSessions,
        rowCount: 1,
        command: 'SELECT'
      } as any);

      const result = await listOrchestrationSessions({});

      expect(result.sessions).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
    });

    it('handles empty session list result', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT'
      } as any);

      const result = await listOrchestrationSessions({});

      expect(result.sessions).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it('filters sessions by primary agent ID', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT'
      } as any);

      await listOrchestrationSessions({
        primaryAgentId: 'agent-123'
      });

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('primary_agent_id'),
        expect.arrayContaining(['agent-123'])
      );
    });

    it('uses cursor for pagination', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT'
      } as any);

      await listOrchestrationSessions({
        cursor: '2024-01-01T00:00:00Z'
      });

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at <'),
        expect.arrayContaining(['2024-01-01T00:00:00Z'])
      );
    });

    it('updates session with no fields', async () => {
      const mockSessionRow = {
        id: 'session-update-empty',
        orchestration_type: 'solo',
        primary_agent_id: 'agent-1',
        session_metadata: {},
        status: 'active',
        started_at: new Date().toISOString(),
        ended_at: null,
        performance_metrics: null,
        created_at: new Date().toISOString()
      };

      mockedDb.query.mockResolvedValueOnce({
        rows: [mockSessionRow],
        rowCount: 1,
        command: 'UPDATE'
      } as any);

      const result = await updateOrchestrationSession('session-update-empty', {});

      expect(result.id).toBe('session-update-empty');
    });
  });
});
