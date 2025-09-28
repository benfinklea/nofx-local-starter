import type { VercelRequest, VercelResponse } from '@vercel/node';

describe('registry API routes', () => {
  const makeRes = () => {
    const res: VercelResponse & { body?: unknown } = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    } as unknown as VercelResponse & { body?: unknown };

    res.status = jest.fn(res.status.bind(res)) as VercelResponse['status'];
    res.json = jest.fn(res.json.bind(res)) as VercelResponse['json'];
    return res;
  };

  beforeEach(() => {
    jest.resetModules();
  });

  test('GET /api/agents returns json payload', async () => {
    jest.doMock('../../src/lib/auth', () => ({
      isAdmin: () => true
    }));
    jest.doMock('../../src/lib/registry', () => ({
      listAgents: jest.fn(async () => ({ agents: [], nextCursor: undefined }))
    }));
    const handler = (await import('../../api/agents/index')).default;

    const req = { method: 'GET', query: {} } as unknown as VercelRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ agents: [], nextCursor: undefined });
  });

  test('POST /api/agents/publish validates body and marks inbox', async () => {
    jest.doMock('../../src/lib/auth', () => ({
      isAdmin: () => true
    }));
    const publishAgent = jest.fn(async () => ({ agentId: 'doc-writer', currentVersion: '1.0.0' }));
    const inboxMarkIfNew = jest.fn().mockResolvedValue(true);
    const inboxDelete = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../../src/lib/registry', () => ({
      publishAgent
    }));
    jest.doMock('../../src/lib/store', () => ({
      store: {
        inboxMarkIfNew,
        inboxDelete
      }
    }));
    const handler = (await import('../../api/agents/publish')).default;

    const req = {
      method: 'POST',
      body: {
        agentId: 'doc-writer',
        name: 'Doc Writer',
        manifest: {},
        version: '1.0.0'
      }
    } as unknown as VercelRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toHaveProperty('agent');
    expect(inboxMarkIfNew).toHaveBeenCalledWith('registry:agent:doc-writer:1.0.0');
    expect(inboxDelete).toHaveBeenCalledWith('registry:agent:doc-writer:1.0.0');
  });

  test('POST /api/agents/publish skips duplicate when inbox returns false', async () => {
    jest.doMock('../../src/lib/auth', () => ({
      isAdmin: () => true
    }));
    jest.doMock('../../src/lib/registry', () => ({
      publishAgent: jest.fn()
    }));
    jest.doMock('../../src/lib/store', () => ({
      store: {
        inboxMarkIfNew: jest.fn().mockResolvedValue(false),
        inboxDelete: jest.fn()
      }
    }));
    const handler = (await import('../../api/agents/publish')).default;

    const req = {
      method: 'POST',
      body: {
        agentId: 'doc-writer',
        name: 'Doc Writer',
        manifest: {},
        version: '1.0.0'
      }
    } as unknown as VercelRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.body).toEqual({ status: 'skipped', reason: 'duplicate' });
  });

  test('POST /api/templates/publish marks inbox and returns template', async () => {
    jest.doMock('../../src/lib/auth', () => ({
      isAdmin: () => true
    }));
    const publishTemplate = jest.fn(async () => ({ templateId: 'readme', currentVersion: '1.0.0' }));
    const inboxMarkIfNew = jest.fn().mockResolvedValue(true);
    const inboxDelete = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../../src/lib/registry', () => ({
      publishTemplate
    }));
    jest.doMock('../../src/lib/store', () => ({
      store: {
        inboxMarkIfNew,
        inboxDelete
      }
    }));
    const handler = (await import('../../api/templates/publish')).default;

    const req = {
      method: 'POST',
      body: {
        templateId: 'readme',
        name: 'README',
        content: {},
        version: '1.0.0'
      }
    } as unknown as VercelRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toHaveProperty('template');
    expect(inboxMarkIfNew).toHaveBeenCalledWith('registry:template:readme:1.0.0');
    expect(inboxDelete).toHaveBeenCalledWith('registry:template:readme:1.0.0');
  });
});
