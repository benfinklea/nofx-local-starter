import { performance } from 'perf_hooks';

const queryMock = jest.fn();
const withTransactionMock = jest.fn(async (fn: () => Promise<unknown>) => fn());

jest.mock('../../src/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  withTransaction: (fn: () => Promise<unknown>) => withTransactionMock(fn)
}));

jest.mock('../../src/lib/metrics', () => ({
  metrics: {
    httpRequestDuration: { observe: jest.fn() },
    stepDuration: { observe: jest.fn() },
    dbQueryDuration: { observe: jest.fn() },
    stepsTotal: { inc: jest.fn() },
    retriesTotal: { inc: jest.fn() },
    queueDepth: { set: jest.fn() },
    dlqSize: { set: jest.fn() },
    queueOldestAgeMs: { set: jest.fn() },
    registryOperationDuration: { observe: jest.fn() },
    render: jest.fn(async () => '# metrics')
  }
}));

jest.mock('../../src/lib/observability', () => ({
  timeIt: async <T>(op: string, fn: () => Promise<T>) => {
    const start = performance.now();
    const result = await fn();
    const latencyMs = performance.now() - start;
    return { result, latencyMs };
  },
  log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

describe('registry performance benchmarks', () => {
  const agentRow = {
    id: 'agent-row-id',
    agent_id: 'doc-writer',
    name: 'Doc Writer',
    description: 'Writes docs',
    status: 'active',
    current_version: '1.0.0',
    tags: ['docs'],
    capabilities: [],
    metadata: {},
    owner_id: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z'
  };

  const agentVersionRow = {
    id: 'agent-version-row-id',
    agent_id: 'agent-row-id',
    version: '1.0.0',
    status: 'active',
    manifest: {},
    checksum: null,
    source_commit: null,
    published_at: '2024-01-02T00:00:00.000Z'
  };

  const templateRow = {
    id: 'template-row-id',
    template_id: 'readme',
    name: 'README Template',
    description: 'Docs template',
    status: 'published',
    current_version: '1.0.0',
    tags: ['docs'],
    category: 'documentation',
    metadata: {},
    owner_id: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z'
  };

  const templateVersionRow = {
    id: 'template-version-row-id',
    template_id: 'template-row-id',
    version: '1.0.0',
    status: 'published',
    content: {},
    checksum: null,
    change_summary: null,
    published_at: '2024-01-02T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.resetModules();
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('select 1 from nofx.agent_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_registry')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_usage_daily')) return { rows: [{ ok: 1 }] };
      if (sql.includes('select 1 from nofx.template_feedback')) return { rows: [{ ok: 1 }] };
      if (sql.startsWith('select * from nofx.agent_registry where agent_id = $1 limit 1')) {
        return { rows: [agentRow] };
      }
      if (sql.startsWith('select * from nofx.agent_versions where agent_id = $1 order by published_at desc')) {
        return { rows: [agentVersionRow] };
      }
      if (sql.startsWith('select * from nofx.agent_versions where agent_id = $1 and version = $2')) {
        return { rows: [agentVersionRow] };
      }
      if (sql.startsWith('update nofx.agent_registry')) {
        return { rows: [agentRow] };
      }
      if (sql.startsWith('insert into nofx.agent_registry')) {
        return { rows: [agentRow] };
      }
      if (sql.startsWith('insert into nofx.agent_versions')) {
        return { rows: [agentVersionRow] };
      }
      if (sql.startsWith('update nofx.agent_versions set status')) {
        return { rows: [] };
      }
      if (sql.startsWith('select * from nofx.agent_registry')) {
        return { rows: [agentRow] };
      }
      if (sql.startsWith('select * from nofx.template_registry where template_id = $1 limit 1')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('select * from nofx.template_versions where template_id = $1 order by published_at desc')) {
        return { rows: [templateVersionRow] };
      }
      if (sql.startsWith('select * from nofx.template_versions where template_id = $1 and version = $2')) {
        return { rows: [templateVersionRow] };
      }
      if (sql.startsWith('update nofx.template_registry')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('insert into nofx.template_registry')) {
        return { rows: [templateRow] };
      }
      if (sql.startsWith('insert into nofx.template_versions')) {
        return { rows: [templateVersionRow] };
      }
      if (sql.startsWith('update nofx.template_versions set status = \'')) {
        return { rows: [] };
      }
      if (sql.includes('from nofx.template_usage_daily')) {
        return { rows: [] };
      }
      if (sql.includes('from nofx.template_feedback')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  test('listAgents completes under 50ms', async () => {
    const registry = await import('../../src/lib/registry');
    const start = performance.now();
    await registry.listAgents({ limit: 10 });
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });

  test('publishAgent completes under 75ms', async () => {
    const registry = await import('../../src/lib/registry');
    const start = performance.now();
    await registry.publishAgent({
      agentId: 'doc-writer',
      name: 'Doc Writer',
      manifest: {},
      version: '1.0.1'
    } as any);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(75);
  });

  test('listTemplates completes under 50ms', async () => {
    const registry = await import('../../src/lib/registry');
    const start = performance.now();
    await registry.listTemplates({ limit: 10 });
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });

  test('publishTemplate completes under 75ms', async () => {
    const registry = await import('../../src/lib/registry');
    const start = performance.now();
    await registry.publishTemplate({
      templateId: 'readme',
      name: 'README Template',
      content: {},
      version: '1.0.1'
    } as any);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(75);
  });
});
