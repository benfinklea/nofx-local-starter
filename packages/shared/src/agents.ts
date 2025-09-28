export type AgentStatus = 'draft' | 'active' | 'deprecated' | 'disabled';

export interface AgentCapability {
  id: string;
  label: string;
  description?: string;
}

export interface AgentVersionSummary {
  id: string;
  version: string;
  status: AgentStatus;
  publishedAt: string;
  checksum?: string;
  sourceCommit?: string;
}

export interface AgentSummary {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  status: AgentStatus;
  currentVersion: string;
  capabilities: AgentCapability[];
  tags: string[];
  updatedAt: string;
}

export interface AgentDetail extends AgentSummary {
  versions: AgentVersionSummary[];
  metadata?: Record<string, unknown>;
  ownerId?: string;
  createdAt: string;
}

export interface PublishAgentRequest {
  agentId: string;
  name: string;
  description?: string;
  manifest: Record<string, unknown>;
  version: string;
  capabilities?: AgentCapability[];
  tags?: string[];
  sourceCommit?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishAgentResponse {
  agent: AgentDetail;
}

export interface ListAgentsQuery {
  status?: AgentStatus;
  tag?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface ListAgentsResponse {
  agents: AgentSummary[];
  nextCursor?: string;
}

export interface ValidateAgentResponse {
  valid: boolean;
  errors: { field: string; message: string }[];
}
