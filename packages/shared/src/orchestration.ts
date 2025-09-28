/**
 * Phase 2: Multi-Agent Orchestration Types
 * Defines the core types for agent coordination and orchestration patterns
 */

// ============================================
// ORCHESTRATION CORE TYPES
// ============================================

export type OrchestrationType = 'solo' | 'pair' | 'hierarchical' | 'swarm';
export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';
export type RelationshipType = 'supervisor' | 'peer' | 'subordinate';

export interface AgentSession {
  id: string;
  orchestrationType: OrchestrationType;
  primaryAgentId?: string;
  sessionMetadata: Record<string, unknown>;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  performanceMetrics?: PerformanceMetrics;
  createdAt: string;
}

export interface AgentRelationship {
  id: string;
  sessionId: string;
  supervisorAgentId: string;
  workerAgentId: string;
  relationshipType: RelationshipType;
  createdAt: string;
}

export interface AgentCommunication {
  id: string;
  sessionId: string;
  fromAgentId: string;
  toAgentId?: string; // null for broadcast
  messageType: string;
  payload: Record<string, unknown>;
  acknowledgedAt?: string;
  processedAt?: string;
  createdAt: string;
}

export interface AgentCapability {
  id: string;
  agentId: string;
  skillId: string;
  proficiencyLevel: number; // 1-10
  resourceRequirements: ResourceProfile;
  averageLatencyMs?: number;
  successRate?: number; // 0-1
  costPerOperation?: number;
  updatedAt: string;
}

// ============================================
// CAPABILITY & RESOURCE TYPES
// ============================================

export interface ResourceProfile {
  cpu?: number; // CPU cores required
  memory?: number; // Memory in MB
  gpu?: boolean; // GPU required
  apiCalls?: number; // Expected API calls
  estimatedTimeMs?: number;
}

export interface CapabilityRequirement {
  skillId: string;
  minProficiency?: number;
  maxLatencyMs?: number;
  minSuccessRate?: number;
  maxCost?: number;
}

export interface AgentSelectionCriteria {
  requiredCapabilities: CapabilityRequirement[];
  orchestrationType: OrchestrationType;
  resourceConstraints?: ResourceProfile;
  costBudget?: number;
  preferredAgents?: string[];
  excludedAgents?: string[];
}

// ============================================
// ORCHESTRATION MANAGEMENT TYPES
// ============================================

export interface CreateSessionRequest {
  orchestrationType: OrchestrationType;
  agentSelectionCriteria?: AgentSelectionCriteria;
  sessionMetadata?: Record<string, unknown>;
  autoStart?: boolean;
}

export interface CreateSessionResponse {
  session: AgentSession;
  selectedAgents: SelectedAgent[];
  estimatedCost?: number;
  estimatedDuration?: number;
}

export interface SelectedAgent {
  agentId: string;
  agentName: string;
  role: 'primary' | 'secondary' | 'supervisor' | 'worker';
  capabilities: AgentCapability[];
  assignedTasks?: string[];
}

export interface SessionUpdateRequest {
  status?: SessionStatus;
  performanceMetrics?: PerformanceMetrics;
  endedAt?: string;
}

// ============================================
// AGENT COMMUNICATION TYPES
// ============================================

export interface SendMessageRequest {
  sessionId: string;
  fromAgentId: string;
  toAgentId?: string; // null for broadcast
  messageType: MessageType;
  payload: Record<string, unknown>;
  requireAcknowledgment?: boolean;
}

export type MessageType =
  | 'task_assignment'
  | 'status_update'
  | 'result_share'
  | 'error_report'
  | 'coordination'
  | 'context_handoff'
  | 'capability_query'
  | 'resource_request';

export interface MessageResponse {
  messageId: string;
  delivered: boolean;
  acknowledgedBy?: string[];
  error?: string;
}

// ============================================
// PERFORMANCE & METRICS TYPES
// ============================================

export interface PerformanceMetrics {
  totalDurationMs: number;
  agentExecutionTimes: Record<string, number>;
  messagesExchanged: number;
  tasksCompleted: number;
  tasksFailed: number;
  resourceUsage: ResourceUsage;
  costIncurred: number;
  efficiencyScore?: number;
}

export interface ResourceUsage {
  totalCpuTime: number;
  totalMemoryMb: number;
  apiCallsCount: number;
  networkBandwidthMb?: number;
}

// ============================================
// SMART ROUTING TYPES
// ============================================

export interface RoutingDecision {
  selectedAgentId: string;
  score: number;
  reasoning: string;
  alternatives: AlternativeAgent[];
}

export interface AlternativeAgent {
  agentId: string;
  score: number;
  gaps: string[]; // Missing capabilities or constraints
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-loaded' | 'capability-weighted' | 'cost-optimized';
  parameters?: Record<string, unknown>;
}

// ============================================
// SESSION QUERY TYPES
// ============================================

export interface ListSessionsQuery {
  orchestrationType?: OrchestrationType;
  status?: SessionStatus;
  startedAfter?: string;
  startedBefore?: string;
  primaryAgentId?: string;
  limit?: number;
  cursor?: string;
}

export interface ListSessionsResponse {
  sessions: AgentSession[];
  nextCursor?: string;
  totalCount?: number;
}

// ============================================
// ORCHESTRATION PATTERNS
// ============================================

export interface SoloModeConfig {
  agentId: string;
  enhancedCapabilities?: string[]; // Additional capabilities to enable
  resourceBoost?: ResourceProfile; // Extra resources for solo mode
}

export interface PairModeConfig {
  primaryAgentId: string;
  secondaryAgentId: string;
  interactionMode: 'collaborative' | 'reviewer' | 'validator';
  contextSharing: boolean;
}

export interface HierarchicalModeConfig {
  supervisorAgentId: string;
  workerAgentIds: string[];
  delegationStrategy: 'capability-based' | 'load-balanced' | 'priority-based';
  maxWorkers?: number;
  allowDynamicScaling?: boolean;
}

export interface SwarmModeConfig {
  agentIds: string[];
  coordinationStrategy: 'consensus' | 'voting' | 'leader-election';
  minAgentsRequired: number;
  taskDistribution: 'broadcast' | 'partition' | 'competitive';
}

export type OrchestrationConfig =
  | { type: 'solo'; config: SoloModeConfig }
  | { type: 'pair'; config: PairModeConfig }
  | { type: 'hierarchical'; config: HierarchicalModeConfig }
  | { type: 'swarm'; config: SwarmModeConfig };

// ============================================
// ERROR HANDLING TYPES
// ============================================

export interface OrchestrationError {
  code: OrchestrationErrorCode;
  message: string;
  sessionId?: string;
  agentId?: string;
  details?: Record<string, unknown>;
}

export type OrchestrationErrorCode =
  | 'AGENT_NOT_AVAILABLE'
  | 'CAPABILITY_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'COMMUNICATION_FAILED'
  | 'RESOURCE_EXCEEDED'
  | 'COORDINATION_TIMEOUT'
  | 'INVALID_ORCHESTRATION_TYPE';

// ============================================
// API ENDPOINT TYPES
// ============================================

export interface OrchestrationEndpoints {
  // Session management
  '/api/orchestration/sessions': {
    POST: { body: CreateSessionRequest; response: CreateSessionResponse };
    GET: { query: ListSessionsQuery; response: ListSessionsResponse };
  };

  '/api/orchestration/sessions/:id': {
    GET: { response: AgentSession };
    PATCH: { body: SessionUpdateRequest; response: AgentSession };
    DELETE: { response: { success: boolean } };
  };

  // Agent selection and routing
  '/api/orchestration/agents/select': {
    POST: { body: AgentSelectionCriteria; response: RoutingDecision };
  };

  // Communication
  '/api/orchestration/communicate': {
    POST: { body: SendMessageRequest; response: MessageResponse };
  };

  // Relationships
  '/api/orchestration/relationships': {
    POST: { body: Omit<AgentRelationship, 'id' | 'createdAt'>; response: AgentRelationship };
    GET: { query: { sessionId: string }; response: AgentRelationship[] };
  };
}