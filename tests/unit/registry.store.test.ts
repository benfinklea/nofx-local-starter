import type { PublishAgentRequest } from '../../packages/shared/src/agents';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';

describe('registry store', () => {
  let queryMock: jest.Mock;
  let withTransactionMock: jest.Mock;
  let registry: typeof import('../../src/lib/registry');

  beforeEach(async () => {
    jest.resetModules();
    queryMock = jest.fn();
    withTransactionMock = jest.fn(async (fn: () => Promise<unknown>) => fn());
    jest.doMock('../../src/lib/db', () => ({
      query: queryMock,
      withTransaction: withTransactionMock
    }));
    registry = await import('../../src/lib/registry');
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('listAgents maps rows into shared shape', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('select 1 from nofx.agent_registry')) {
        return { rows: [{ ok: 1 }] };
      }
      if (sql.includes('select 1 from nofx.template_registry')) {
        return { rows: [{ ok: 1 }] };
      }
      if (sql.includes('select 1 from nofx.template_usage_daily')) {
        return { rows: [{ ok: 1 }] };
      }
      if (sql.includes('select 1 from nofx.template_feedback')) {
        return { rows: [{ ok: 1 }] };
      }
      if (sql.includes('from nofx.agent_registry')) {
        return {
          rows: [
            {
              id: 'agent-row-id',
              agent_id: 'doc-writer',
              name: 'Doc Writer',
              description: 'Writes docs',
              status: 'active',
              current_version: '1.2.0',
              tags: ['docs'],
              capabilities: [],
              metadata: {},
              owner_id: null,
              created_at: '2024-02-01T00:00:00.000Z',
              updated_at: '2024-02-02T00:00:00.000Z'
            }
          ]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.listAgents({ status: 'active' });
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({
      agentId: 'doc-writer',
      name: 'Doc Writer',
      status: 'active',
      currentVersion: '1.2.0'
    });
    expect(queryMock).toHaveBeenCalled();
  });

  test('publishAgent inserts registry and version rows', async () => {
    const payload: PublishAgentRequest = {
      agentId: 'doc-writer',
      name: 'Doc Writer',
      description: 'Writes docs',
      manifest: { entry: 'index.ts' },
      version: '1.0.0'
    };

    const registryRow = {
      id: 'agent-row-id',
      agent_id: 'doc-writer',
      name: 'Doc Writer',
      description: 'Writes docs',
      status: 'active',
      current_version: '1.0.0',
      tags: [],
      capabilities: [],
      metadata: {},
      owner_id: null,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z'
    };

    const versionRow = {
      id: 'version-row-id',
      agent_id: 'agent-row-id',
      version: '1.0.0',
      status: 'active',
      manifest: { entry: 'index.ts' },
      checksum: null,
      source_commit: null,
      published_at: '2024-02-01T00:00:00.000Z'
    };

    let lookupCount = 0;

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select * from nofx.agent_registry where agent_id = $1') && sql.includes('limit 1') && params[0] === 'doc-writer') {
        lookupCount += 1;
        return lookupCount === 1 ? { rows: [] } : { rows: [registryRow] };
      }
      if (sql.startsWith('insert into nofx.agent_registry')) {
        return { rows: [registryRow] };
      }
      if (sql.startsWith('update nofx.agent_versions set status')) {
        return { rows: [] };
      }
      if (sql.startsWith('insert into nofx.agent_versions')) {
        return { rows: [versionRow] };
      }
      if (sql.includes('select * from nofx.agent_registry where agent_id = $1') && sql.includes('limit 1')) {
        return { rows: [registryRow] };
      }
      if (sql.startsWith('select * from nofx.agent_versions where agent_id = $1')) {
        return { rows: [versionRow] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.publishAgent(payload);
    expect(result).toMatchObject({
      agentId: 'doc-writer',
      currentVersion: '1.0.0'
    });
    expect(withTransactionMock).toHaveBeenCalled();
  });

  test('validateTemplate returns errors when required fields missing', async () => {
    const templatePayload: PublishTemplateRequest = {
      templateId: '',
      name: '',
      content: {},
      version: ''
    };

    const result = await registry.validateTemplate(templatePayload);
    expect(result.valid).toBe(false);
    expect(result.errors.map(e => e.field)).toEqual(expect.arrayContaining(['templateId', 'name', 'version']));
  });

  test('getAgent returns null when not found', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select * from nofx.agent_registry where agent_id = $1') && sql.includes('limit 1')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.getAgent('missing-agent');
    expect(result).toBeNull();
  });

  test('listTemplates maps rows into shared shape', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.includes('from nofx.template_registry')) {
        return {
          rows: [
            {
              id: 'tmpl-row-id',
              template_id: 'readme',
              name: 'README',
              description: 'doc template',
              status: 'published',
              current_version: '2.0.0',
              tags: ['docs'],
              category: 'documentation',
              metadata: {},
              owner_id: null,
              created_at: '2024-02-01T00:00:00.000Z',
              updated_at: '2024-02-03T00:00:00.000Z'
            }
          ]
        };
      }
      if (sql.includes('from nofx.template_usage_daily')) {
        return {
          rows: [
            {
              template_id: 'tmpl-row-id',
              usage_count_30d: '5',
              success_count_30d: '4',
              total_duration_ms_30d: '60000',
              total_token_usage_30d: '1000',
              last_run_at: '2024-02-03T00:00:00.000Z'
            }
          ]
        };
      }
      if (sql.includes('from nofx.template_feedback')) {
        return {
          rows: [
            {
              template_id: 'tmpl-row-id',
              average_rating: '4.5',
              rating_count: '2'
            }
          ]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.listTemplates({ category: 'documentation' });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      templateId: 'readme',
      name: 'README',
      category: 'documentation',
      popularityScore: 4,
      ratingAverage: 4.5,
      ratingCount: 2
    });
  });

  test('publishTemplate inserts registry and version rows', async () => {
    const payload: PublishTemplateRequest = {
      templateId: 'readme',
      name: 'README',
      description: 'doc template',
      content: { sections: [] },
      version: '1.0.0'
    };

    const templateRow = {
      id: 'tmpl-row-id',
      template_id: 'readme',
      name: 'README',
      description: 'doc template',
      status: 'published',
      current_version: '1.0.0',
      tags: [],
      category: null,
      metadata: {},
      owner_id: null,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z'
    };

    const versionRow = {
      id: 'tmpl-version-row-id',
      template_id: 'tmpl-row-id',
      version: '1.0.0',
      status: 'published',
      content: { sections: [] },
      checksum: null,
      change_summary: null,
      published_at: '2024-02-01T00:00:00.000Z'
    };

    let lookupCount = 0;

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.startsWith('select * from nofx.template_registry where template_id = $1 limit 1') && params[0] === 'readme') {
        lookupCount += 1;
        return lookupCount === 1 ? { rows: [] } : { rows: [templateRow] };
      }
      if (sql.startsWith('insert into nofx.template_registry')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('update nofx.template_versions set status')) {
        return { rows: [] };
      }
      if (sql.startsWith('insert into nofx.template_versions')) {
        return { rows: [versionRow] };
      }
      if (sql.startsWith('select * from nofx.template_versions where template_id = $1')) {
        return { rows: [versionRow] };
      }
      if (sql.toLowerCase().includes('sum(usage_count)')) {
        return { rows: [] };
      }
      if (sql.toLowerCase().includes('template_usage_daily')) {
        return { rows: [] };
      }
      if (sql.toLowerCase().includes('template_feedback')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.publishTemplate(payload);
    expect(result).toMatchObject({
      templateId: 'readme',
      currentVersion: '1.0.0'
    });
  });

  test('rollbackAgent activates target version', async () => {
    const agentRow = {
      id: 'agent-row-id',
      agent_id: 'doc-writer',
      name: 'Doc Writer',
      description: null,
      status: 'active',
      current_version: '2.0.0',
      tags: [],
      capabilities: [],
      metadata: {},
      owner_id: null,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-05T00:00:00.000Z'
    };
    const versionRows = [
      {
        id: 'v1',
        agent_id: 'agent-row-id',
        version: '1.0.0',
        status: 'archived',
        manifest: {},
        checksum: null,
        source_commit: null,
        published_at: '2024-02-01T00:00:00.000Z'
      },
      {
        id: 'v2',
        agent_id: 'agent-row-id',
        version: '2.0.0',
        status: 'active',
        manifest: {},
        checksum: null,
        source_commit: null,
        published_at: '2024-02-05T00:00:00.000Z'
      }
    ];

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select * from nofx.agent_registry where agent_id = $1') && sql.includes('limit 1')) {
        return { rows: [agentRow] };
      }
      if (sql.startsWith('select * from nofx.agent_versions where agent_id = $1 and version = $2')) {
        return { rows: [versionRows[0]] };
      }
      if (sql.startsWith('update nofx.agent_versions set status')) {
        const targetVersion = params[1];
        versionRows.forEach(v => {
          v.status = v.version === targetVersion ? 'active' : 'archived';
        });
        return { rows: [] };
      }
      if (sql.startsWith('update nofx.agent_registry set current_version')) {
        agentRow.current_version = params[1] as string;
        return { rows: [] };
      }
      if (sql.startsWith('select * from nofx.agent_versions where agent_id = $1')) {
        return { rows: versionRows };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const detail = await registry.rollbackAgent('doc-writer', '1.0.0');
    expect(detail.currentVersion).toBe('1.0.0');
  });

  test('recordTemplateUsage upserts daily counters', async () => {
    const templateRow = {
      id: 'tmpl-row-id',
      template_id: 'readme'
    };
    const upsertSpy = jest.fn().mockResolvedValue({ rows: [] });

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.startsWith('select id from nofx.template_registry where template_id = $1')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('insert into nofx.template_usage_daily')) {
        upsertSpy(sql, params);
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await registry.recordTemplateUsage({ templateId: 'readme', outcome: 'success', durationMs: 2500, tokenUsage: 150 });

    expect(withTransactionMock).toHaveBeenCalled();
    expect(upsertSpy).toHaveBeenCalled();
    const [, params] = upsertSpy.mock.calls[0];
    expect(params).toEqual([
      'tmpl-row-id',
      1,
      2500,
      150
    ]);
  });

  test('submitTemplateRating inserts feedback and returns aggregate', async () => {
    const templateRow = {
      id: 'tmpl-row-id',
      template_id: 'readme'
    };

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.startsWith('select id from nofx.template_registry where template_id = $1')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('insert into nofx.template_feedback')) {
        expect(params).toEqual(['tmpl-row-id', 5, 'Great template', 'user-1']);
        return { rows: [] };
      }
      if (sql.startsWith('select avg(rating)::numeric as average_rating')) {
        return { rows: [{ average_rating: '4.5', rating_count: '8' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await registry.submitTemplateRating({
      templateId: 'readme',
      rating: 5,
      comment: 'Great template',
      submittedBy: 'user-1'
    });

    expect(withTransactionMock).toHaveBeenCalled();
    expect(result).toEqual({ averageRating: 4.5, ratingCount: 8 });
  });

  test('rollbackTemplate resets version status', async () => {
    const templateRow = {
      id: 'tmpl-row-id',
      template_id: 'readme',
      name: 'README',
      description: null,
      status: 'published',
      current_version: '2.0.0',
      tags: [],
      category: null,
      metadata: {},
      owner_id: null,
      created_at: '2024-02-01T00:00:00.000Z',
      updated_at: '2024-02-04T00:00:00.000Z'
    };
    const versionRow = {
      id: 'tmpl-version-row-id',
      template_id: 'tmpl-row-id',
      version: '1.0.0',
      status: 'archived',
      content: {},
      checksum: null,
      change_summary: null,
      published_at: '2024-02-01T00:00:00.000Z'
    };

    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.startsWith('select * from nofx.template_registry where template_id = $1 limit 1')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('select * from nofx.template_versions where template_id = $1 and version = $2')) {
        return { rows: [versionRow] };
      }
      if (sql.startsWith('update nofx.template_versions set status = case when version = $2')) {
        return { rows: [] };
      }
      if (sql.startsWith('update nofx.template_registry set current_version')) {
        templateRow.current_version = params[1] as string;
        return { rows: [] };
      }
      if (sql.startsWith('select * from nofx.template_versions where template_id = $1 order by published_at desc')) {
        return { rows: [versionRow] };
      }
      if (sql.includes('from nofx.template_usage_daily')) {
        return { rows: [] };
      }
      if (sql.includes('from nofx.template_feedback')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const detail = await registry.rollbackTemplate('readme', '1.0.0');
    expect(detail.currentVersion).toBe('1.0.0');
  });

  test('ensureSchema throws helpful error when tables missing', async () => {
    queryMock.mockImplementation(() => {
      throw new Error('relation "nofx.agent_registry" does not exist');
    });

    await expect(registry.listAgents()).rejects.toThrow('Agent/template registry tables are missing');
  });
});
