import { searchRegistry } from '../../src/services/registryIntegration';
import type { ListAgentsResponse } from '../../packages/shared/src/agents';
import type { ListTemplatesResponse, TemplateDetail } from '../../packages/shared/src/templates';

jest.mock('../../src/lib/registry', () => ({
  listAgents: jest.fn(),
  listTemplates: jest.fn(),
  getTemplate: jest.fn()
}));

jest.mock('../../src/lib/metrics', () => ({
  metrics: {
    registryOperationDuration: {
      observe: jest.fn()
    }
  }
}));

type RegistryModule = typeof import('../../src/lib/registry');
const registry = jest.mocked(require('../../src/lib/registry') as RegistryModule);
const metrics = jest.mocked(require('../../src/lib/metrics'));

describe('registryIntegration.searchRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('combines agents and templates with cross references', async () => {
    const agentResponse: ListAgentsResponse = {
      agents: [
        {
          id: 'a-internal',
          agentId: 'agent-alpha',
          name: 'Agent Alpha',
          description: 'Handles alpha flows',
          status: 'active',
          currentVersion: '1.0.0',
          tags: ['alpha'],
          capabilities: [],
          updatedAt: '2025-03-01T00:00:00.000Z'
        }
      ]
    };

    const templateResponse: ListTemplatesResponse = {
      templates: [
        {
          id: 'tpl-001',
          templateId: 'template-one',
          name: 'Template One',
          description: 'Uses Agent Alpha',
          status: 'published',
          currentVersion: '2.0.0',
          tags: ['alpha'],
          category: 'demo',
          updatedAt: '2025-04-01T00:00:00.000Z'
        }
      ]
    };

    const templateDetail: TemplateDetail = {
      ...templateResponse.templates[0],
      createdAt: '2025-03-01T00:00:00.000Z',
      versions: [],
      metadata: {
        agents: ['agent-alpha']
      }
    };

    registry.listAgents.mockResolvedValue(agentResponse);
    registry.listTemplates.mockResolvedValue(templateResponse);
    registry.getTemplate.mockResolvedValue(templateDetail);

    const results = await searchRegistry({ search: 'alpha' });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      type: 'template',
      id: 'template-one',
      relatedAgents: ['agent-alpha']
    });
    expect(results[1]).toMatchObject({
      type: 'agent',
      id: 'agent-alpha'
    });
    expect(metrics.metrics.registryOperationDuration.observe).toHaveBeenCalledWith({ entity: 'agent', action: 'search' }, expect.any(Number));
    expect(metrics.metrics.registryOperationDuration.observe).toHaveBeenCalledWith({ entity: 'template', action: 'search' }, expect.any(Number));
  });

  test('applies limit across combined results', async () => {
    registry.listAgents.mockResolvedValue({
      agents: [
        {
          id: 'a',
          agentId: 'agent-a',
          name: 'Agent A',
          description: undefined,
          status: 'active',
          currentVersion: '1.0.0',
          tags: [],
          capabilities: [],
          updatedAt: '2025-03-01T00:00:00.000Z'
        }
      ]
    });

    registry.listTemplates.mockResolvedValue({
      templates: [
        {
          id: 't',
          templateId: 'template-a',
          name: 'Template A',
          description: undefined,
          status: 'published',
          currentVersion: '1.0.0',
          tags: [],
          category: undefined,
          updatedAt: '2025-02-01T00:00:00.000Z'
        }
      ]
    });

    registry.getTemplate.mockResolvedValue(null);

    const results = await searchRegistry({ limit: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('agent-a');
  });
});
