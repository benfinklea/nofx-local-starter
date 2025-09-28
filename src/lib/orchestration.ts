/**
 * Phase 2: Multi-Agent Orchestration Service
 * Core implementation for agent coordination and orchestration patterns
 */

import { query, withTransaction } from './db';
import { timeIt, log } from './observability';
import { metrics } from './metrics';
import type {
  AgentSession,
  CreateSessionRequest,
  CreateSessionResponse,
  SelectedAgent,
  AgentSelectionCriteria,
  RoutingDecision,
  SendMessageRequest,
  MessageResponse,
  ListSessionsQuery,
  ListSessionsResponse,
  SessionUpdateRequest,
  OrchestrationType,
  AgentCapability,
  CapabilityRequirement,
  OrchestrationError,
  OrchestrationConfig,
  AgentRelationship,
  PerformanceMetrics
} from '../../packages/shared/src/orchestration';
import type { AgentDetail } from '../../packages/shared/src/agents';

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function createOrchestrationSession(
  request: CreateSessionRequest
): Promise<CreateSessionResponse> {
  return timeIt('orchestration.createSession', async () => {
    const { orchestrationType, agentSelectionCriteria, sessionMetadata, autoStart } = request;

    // Select agents based on criteria
    const selectedAgents = agentSelectionCriteria
      ? await selectAgentsForOrchestration(agentSelectionCriteria)
      : [];

    if (agentSelectionCriteria && selectedAgents.length === 0) {
      throw createOrchestrationError('AGENT_NOT_AVAILABLE', 'No agents match the selection criteria');
    }

    // Calculate estimated cost and duration
    const estimates = calculateSessionEstimates(selectedAgents, orchestrationType);

    // Create session in database
    const session = await withTransaction(async (client) => {
      // Create the session
      const sessionResult = await query(
        `
        insert into nofx.agent_sessions (
          orchestration_type,
          primary_agent_id,
          session_metadata,
          status
        )
        values ($1, $2, $3, $4)
        returning *
        `,
        [
          orchestrationType,
          selectedAgents[0]?.agentId || null,
          sessionMetadata || {},
          autoStart ? 'active' : 'pending'
        ],
        client
      );

      const session = mapSessionRow(sessionResult.rows[0]);

      // Create relationships for hierarchical mode
      if (orchestrationType === 'hierarchical' && selectedAgents.length > 1) {
        await createAgentRelationships(session.id, selectedAgents, client);
      }

      // Log session creation
      metrics.increment('orchestration.sessions.created', {
        type: orchestrationType
      });

      return session;
    });

    log.info({ sessionId: session.id, orchestrationType }, 'Orchestration session created');

    return {
      session,
      selectedAgents,
      estimatedCost: estimates.cost,
      estimatedDuration: estimates.duration
    };
  });
}

export async function updateOrchestrationSession(
  sessionId: string,
  updates: SessionUpdateRequest
): Promise<AgentSession> {
  return timeIt('orchestration.updateSession', async () => {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (updates.status) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }

    if (updates.performanceMetrics) {
      updateFields.push(`performance_metrics = $${paramCount++}`);
      values.push(updates.performanceMetrics);
    }

    if (updates.endedAt) {
      updateFields.push(`ended_at = $${paramCount++}`);
      values.push(updates.endedAt);
    }

    values.push(sessionId);

    const result = await query(
      `
      update nofx.agent_sessions
      set ${updateFields.join(', ')}
      where id = $${paramCount}
      returning *
      `,
      values
    );

    if (result.rows.length === 0) {
      throw createOrchestrationError('SESSION_NOT_FOUND', `Session ${sessionId} not found`);
    }

    return mapSessionRow(result.rows[0]);
  });
}

export async function listOrchestrationSessions(
  queryParams: ListSessionsQuery
): Promise<ListSessionsResponse> {
  return timeIt('orchestration.listSessions', async () => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (queryParams.orchestrationType) {
      conditions.push(`orchestration_type = $${paramCount++}`);
      values.push(queryParams.orchestrationType);
    }

    if (queryParams.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(queryParams.status);
    }

    if (queryParams.primaryAgentId) {
      conditions.push(`primary_agent_id = $${paramCount++}`);
      values.push(queryParams.primaryAgentId);
    }

    if (queryParams.startedAfter) {
      conditions.push(`started_at >= $${paramCount++}`);
      values.push(queryParams.startedAfter);
    }

    if (queryParams.startedBefore) {
      conditions.push(`started_at <= $${paramCount++}`);
      values.push(queryParams.startedBefore);
    }

    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const limit = queryParams.limit || 20;

    // Add cursor pagination if provided
    if (queryParams.cursor) {
      conditions.push(`created_at < $${paramCount++}`);
      values.push(queryParams.cursor);
    }

    values.push(limit + 1); // Fetch one extra to determine if there's a next page

    const result = await query(
      `
      select * from nofx.agent_sessions
      ${whereClause}
      order by created_at desc
      limit $${paramCount}
      `,
      values
    );

    const sessions = result.rows.slice(0, limit).map(mapSessionRow);
    const hasMore = result.rows.length > limit;
    const nextCursor = hasMore ? sessions[sessions.length - 1]?.createdAt : undefined;

    return {
      sessions,
      nextCursor
    };
  });
}

// ============================================
// AGENT SELECTION & ROUTING
// ============================================

export async function selectAgentsForOrchestration(
  criteria: AgentSelectionCriteria
): Promise<SelectedAgent[]> {
  return timeIt('orchestration.selectAgents', async () => {
    const { requiredCapabilities, orchestrationType, resourceConstraints, costBudget } = criteria;

    // Get agents with required capabilities
    const candidateAgents = await findAgentsWithCapabilities(requiredCapabilities);

    // Filter by resource constraints
    const viableAgents = resourceConstraints
      ? filterByResourceConstraints(candidateAgents, resourceConstraints)
      : candidateAgents;

    // Filter by cost budget
    const affordableAgents = costBudget
      ? viableAgents.filter(a => calculateAgentCost(a) <= costBudget)
      : viableAgents;

    // Apply orchestration-specific selection logic
    const selectedAgents = selectByOrchestrationPattern(
      affordableAgents,
      orchestrationType,
      criteria
    );

    log.info(
      {
        criteriaCapabilities: requiredCapabilities.length,
        candidateCount: candidateAgents.length,
        selectedCount: selectedAgents.length
      },
      'Agents selected for orchestration'
    );

    return selectedAgents;
  });
}

async function findAgentsWithCapabilities(
  requirements: CapabilityRequirement[]
): Promise<SelectedAgent[]> {
  if (requirements.length === 0) return [];

  // Build query to find agents with all required capabilities
  const skillIds = requirements.map(r => r.skillId);
  const result = await query(
    `
    select
      a.id as agent_id,
      a.name as agent_name,
      json_agg(
        json_build_object(
          'id', c.id,
          'agentId', c.agent_id,
          'skillId', c.skill_id,
          'proficiencyLevel', c.proficiency_level,
          'successRate', c.success_rate,
          'averageLatencyMs', c.average_latency_ms,
          'costPerOperation', c.cost_per_operation
        )
      ) as capabilities
    from nofx.agent_registry a
    join nofx.agent_capabilities c on c.agent_id = a.id
    where c.skill_id = any($1)
      and a.status = 'active'
    group by a.id, a.name
    having count(distinct c.skill_id) = $2
    `,
    [skillIds, skillIds.length]
  );

  return result.rows.map(row => ({
    agentId: row.agent_id,
    agentName: row.agent_name,
    role: 'worker', // Will be assigned based on orchestration type
    capabilities: row.capabilities
  }));
}

function selectByOrchestrationPattern(
  agents: SelectedAgent[],
  orchestrationType: OrchestrationType,
  criteria: AgentSelectionCriteria
): SelectedAgent[] {
  switch (orchestrationType) {
    case 'solo':
      // Select the best single agent
      if (agents.length > 0) {
        agents[0].role = 'primary';
        return [agents[0]];
      }
      return [];

    case 'pair':
      // Select two complementary agents
      if (agents.length >= 2) {
        agents[0].role = 'primary';
        agents[1].role = 'secondary';
        return agents.slice(0, 2);
      }
      return agents;

    case 'hierarchical':
      // Select supervisor and workers
      if (agents.length > 0) {
        agents[0].role = 'supervisor';
        agents.slice(1).forEach(a => a.role = 'worker');
        return agents;
      }
      return [];

    case 'swarm':
      // Select multiple collaborative agents
      agents.forEach(a => a.role = 'worker');
      return agents.slice(0, 10); // Limit swarm size

    default:
      return agents;
  }
}

// ============================================
// AGENT COMMUNICATION
// ============================================

export async function sendAgentMessage(
  request: SendMessageRequest
): Promise<MessageResponse> {
  return timeIt('orchestration.sendMessage', async () => {
    const { sessionId, fromAgentId, toAgentId, messageType, payload, requireAcknowledgment } = request;

    // Verify session exists and is active
    const session = await getSession(sessionId);
    if (session.status !== 'active') {
      throw createOrchestrationError(
        'COMMUNICATION_FAILED',
        `Cannot send message to inactive session ${sessionId}`
      );
    }

    // Insert message into database
    const result = await query(
      `
      insert into nofx.agent_communications (
        session_id,
        from_agent_id,
        to_agent_id,
        message_type,
        payload
      )
      values ($1, $2, $3, $4, $5)
      returning id, created_at
      `,
      [sessionId, fromAgentId, toAgentId, messageType, payload]
    );

    const messageId = result.rows[0].id;

    // Handle acknowledgment if required
    let acknowledgedBy: string[] = [];
    if (requireAcknowledgment && toAgentId) {
      await query(
        `
        update nofx.agent_communications
        set acknowledged_at = now()
        where id = $1
        `,
        [messageId]
      );
      acknowledgedBy = [toAgentId];
    }

    metrics.increment('orchestration.messages.sent', {
      type: messageType,
      broadcast: toAgentId === null
    });

    return {
      messageId,
      delivered: true,
      acknowledgedBy
    };
  });
}

// ============================================
// RELATIONSHIPS MANAGEMENT
// ============================================

async function createAgentRelationships(
  sessionId: string,
  agents: SelectedAgent[],
  client?: any
): Promise<void> {
  const supervisor = agents.find(a => a.role === 'supervisor');
  const workers = agents.filter(a => a.role === 'worker');

  if (!supervisor || workers.length === 0) return;

  const relationships = workers.map(worker => [
    sessionId,
    supervisor.agentId,
    worker.agentId,
    'supervisor'
  ]);

  await query(
    `
    insert into nofx.agent_relationships (
      session_id,
      supervisor_agent_id,
      worker_agent_id,
      relationship_type
    )
    select * from unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::text[])
    `,
    [
      relationships.map(r => r[0]),
      relationships.map(r => r[1]),
      relationships.map(r => r[2]),
      relationships.map(r => r[3])
    ],
    client
  );
}

export async function getSessionRelationships(sessionId: string): Promise<AgentRelationship[]> {
  const result = await query(
    `
    select
      r.*,
      s.name as supervisor_name,
      w.name as worker_name
    from nofx.agent_relationships r
    join nofx.agent_registry s on s.id = r.supervisor_agent_id
    join nofx.agent_registry w on w.id = r.worker_agent_id
    where r.session_id = $1
    order by r.created_at
    `,
    [sessionId]
  );

  return result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    supervisorAgentId: row.supervisor_agent_id,
    workerAgentId: row.worker_agent_id,
    relationshipType: row.relationship_type,
    createdAt: row.created_at
  }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getSession(sessionId: string): Promise<AgentSession> {
  const result = await query(
    'select * from nofx.agent_sessions where id = $1',
    [sessionId]
  );

  if (result.rows.length === 0) {
    throw createOrchestrationError('SESSION_NOT_FOUND', `Session ${sessionId} not found`);
  }

  return mapSessionRow(result.rows[0]);
}

function mapSessionRow(row: any): AgentSession {
  return {
    id: row.id,
    orchestrationType: row.orchestration_type,
    primaryAgentId: row.primary_agent_id,
    sessionMetadata: row.session_metadata || {},
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    performanceMetrics: row.performance_metrics,
    createdAt: row.created_at
  };
}

function filterByResourceConstraints(
  agents: SelectedAgent[],
  constraints: any
): SelectedAgent[] {
  // Implementation would filter based on resource requirements
  // For now, return all agents
  return agents;
}

function calculateAgentCost(agent: SelectedAgent): number {
  // Calculate estimated cost based on agent capabilities
  const totalCost = agent.capabilities.reduce((sum, cap) => {
    return sum + (cap.costPerOperation || 0);
  }, 0);
  return totalCost;
}

function calculateSessionEstimates(
  agents: SelectedAgent[],
  orchestrationType: OrchestrationType
): { cost: number; duration: number } {
  // Calculate estimated cost and duration based on selected agents
  const totalCost = agents.reduce((sum, agent) => sum + calculateAgentCost(agent), 0);

  // Estimate duration based on orchestration type
  const durationMultipliers: Record<OrchestrationType, number> = {
    solo: 1.0,
    pair: 0.7, // Parallel work reduces time
    hierarchical: 0.5, // Better parallelization
    swarm: 0.3 // Maximum parallelization
  };

  const baseDuration = 60000; // 1 minute base
  const estimatedDuration = baseDuration * durationMultipliers[orchestrationType];

  return {
    cost: totalCost,
    duration: estimatedDuration
  };
}

function createOrchestrationError(
  code: string,
  message: string,
  details?: any
): OrchestrationError {
  return {
    code: code as any,
    message,
    details
  };
}

// ============================================
// CIRCUIT BREAKER FOR AGENTS
// ============================================

const circuitBreakerState = new Map<string, {
  failures: number;
  lastFailure: Date;
  isOpen: boolean;
}>();

export function checkCircuitBreaker(agentId: string): boolean {
  const state = circuitBreakerState.get(agentId);
  if (!state) return true; // Circuit is closed (healthy)

  // Reset circuit after 5 minutes
  if (state.isOpen && Date.now() - state.lastFailure.getTime() > 300000) {
    state.isOpen = false;
    state.failures = 0;
  }

  return !state.isOpen;
}

export function recordAgentFailure(agentId: string): void {
  const state = circuitBreakerState.get(agentId) || {
    failures: 0,
    lastFailure: new Date(),
    isOpen: false
  };

  state.failures++;
  state.lastFailure = new Date();

  // Open circuit after 3 failures
  if (state.failures >= 3) {
    state.isOpen = true;
    log.warn({ agentId, failures: state.failures }, 'Circuit breaker opened for agent');
  }

  circuitBreakerState.set(agentId, state);
}