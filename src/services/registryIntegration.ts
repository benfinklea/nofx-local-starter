import { listAgents, listTemplates, getTemplate } from '../lib/registry';
import { metrics } from '../lib/metrics';
import type { AgentSummary } from '../../packages/shared/src/agents';
import type { TemplateSummary, TemplateDetail } from '../../packages/shared/src/templates';

type RegistryEntityType = 'agent' | 'template';

export interface RegistrySearchOptions {
  search?: string;
  limit?: number;
}

export interface RegistrySearchResult {
  type: RegistryEntityType;
  id: string;
  name: string;
  description?: string;
  status: string;
  tags: string[];
  updatedAt: string;
  relatedAgents?: string[];
}

function toAgentResult(agent: AgentSummary): RegistrySearchResult {
  return {
    type: 'agent',
    id: agent.agentId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    tags: agent.tags,
    updatedAt: agent.updatedAt
  };
}

function extractTemplateAgentRefs(detail: TemplateDetail | null): string[] {
  if (!detail?.metadata) return [];
  const metaAgents = (detail.metadata as Record<string, unknown>).agents;
  if (Array.isArray(metaAgents)) {
    return metaAgents.filter((val): val is string => typeof val === 'string');
  }
  return [];
}

function toTemplateResult(summary: TemplateSummary, detail: TemplateDetail | null): RegistrySearchResult {
  return {
    type: 'template',
    id: summary.templateId,
    name: summary.name,
    description: summary.description,
    status: summary.status,
    tags: summary.tags,
    updatedAt: summary.updatedAt,
    relatedAgents: extractTemplateAgentRefs(detail)
  };
}

export async function searchRegistry(options: RegistrySearchOptions = {}): Promise<RegistrySearchResult[]> {
  const { search, limit = 25 } = options;

  const agentStarted = Date.now();
  const agentsResponse = await listAgents({ search, limit });
  const agentElapsed = Date.now() - agentStarted;
  try { metrics.registryOperationDuration.observe({ entity: 'agent', action: 'search' }, agentElapsed); } catch {}
  const agentResults = agentsResponse.agents.map(toAgentResult);

  const templateStarted = Date.now();
  const templateResponse = await listTemplates({ search, limit });
  const templateElapsed = Date.now() - templateStarted;
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'search' }, templateElapsed); } catch {}

  const templateResults: RegistrySearchResult[] = [];
  for (const summary of templateResponse.templates) {
    let detail: TemplateDetail | null = null;
    try {
      detail = await getTemplate(summary.templateId);
    } catch {
      detail = null;
    }
    templateResults.push(toTemplateResult(summary, detail));
  }

  const combined = [...agentResults, ...templateResults];
  combined.sort((a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf());
  return combined.slice(0, limit);
}
