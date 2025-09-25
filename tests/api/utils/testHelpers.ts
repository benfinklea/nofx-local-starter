import { VercelRequest, VercelResponse } from '@vercel/node';
import { IncomingHttpHeaders } from 'http';
import jwt from 'jsonwebtoken';

/**
 * Create a mock Vercel request object
 */
export function createMockRequest(options: {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: any;
  headers?: IncomingHttpHeaders;
  cookies?: Record<string, string>;
}): VercelRequest {
  return {
    method: options.method || 'GET',
    query: options.query || {},
    body: options.body || null,
    headers: options.headers || {},
    cookies: options.cookies || {},
    url: '/',
    env: {},
  } as unknown as VercelRequest;
}

/**
 * Create a mock Vercel response object
 */
export function createMockResponse(): VercelResponse & {
  _status?: number;
  _json?: any;
  _data?: any;
  _headers: Record<string, string>;
} {
  const res: any = {
    _status: 200,
    _json: null,
    _data: null,
    _headers: {},
    _writes: [],
    _ended: false,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: any) {
      this._json = data;
      return this;
    },
    send(data: any) {
      this._data = data;
      return this;
    },
    setHeader(key: string, value: string) {
      this._headers[key] = value;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
    write(data: any) {
      this._writes.push(String(data));
      this._data = (this._data || '') + data;
      return this;
    },
    get writes() {
      return this._writes;
    },
    get ended() {
      return this._ended;
    },
    get headers() {
      return this._headers;
    },
  };

  return res;
}

/**
 * Generate a valid JWT token for testing
 */
export function generateAuthToken(payload: any = { userId: 'test-user', isAdmin: true }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key', {
    expiresIn: '1h',
  });
}

/**
 * Create authenticated request headers
 */
export function createAuthHeaders(token?: string): IncomingHttpHeaders {
  return {
    authorization: `Bearer ${token || generateAuthToken()}`,
    'content-type': 'application/json',
  };
}

/**
 * Test helper to call an API endpoint handler
 */
export async function callHandler(
  handler: Function,
  options: {
    method?: string;
    query?: Record<string, string | string[]>;
    body?: any;
    headers?: IncomingHttpHeaders;
    authenticated?: boolean;
    req?: any;
  } = {}
) {
  const req = options.req || createMockRequest({
    method: options.method,
    query: options.query,
    body: options.body,
    headers: options.authenticated !== false ? createAuthHeaders() : options.headers,
  });

  const res = createMockResponse();

  await handler(req, res);

  return {
    status: res._status,
    json: res._json,
    data: res._data,
    headers: res._headers,
    writes: (res as any)._writes || [],
    ended: (res as any)._ended || false,
  };
}

/**
 * Mock database store for testing
 */
export const mockStore = {
  getRun: jest.fn(),
  createRun: jest.fn(),
  listRuns: jest.fn(),
  listStepsByRun: jest.fn(),
  listArtifactsByRun: jest.fn(),
  listEvents: jest.fn(),
  listGatesByRun: jest.fn(),
  createOrGetGate: jest.fn(),
  updateGate: jest.fn(),
  resetStep: jest.fn(),
  resetRun: jest.fn(),
  inboxDelete: jest.fn(),
};

/**
 * Mock for the auth module
 */
export const mockAuth = {
  isAdmin: jest.fn().mockReturnValue(true),
};

/**
 * Reset all mocks
 */
export function resetMocks() {
  jest.clearAllMocks();
  Object.values(mockStore).forEach(mock => mock.mockReset());
  mockAuth.isAdmin.mockReturnValue(true);
}

/**
 * Wait for async operations
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test data factories
 */
export const factories = {
  run: (overrides = {}) => ({
    id: 'run-123',
    plan: { steps: [] },
    project_id: 'default',
    status: 'running',
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  step: (overrides = {}) => ({
    id: 'step-123',
    run_id: 'run-123',
    name: 'Test Step',
    tool: 'test-tool',
    status: 'pending',
    inputs: {},
    ...overrides,
  }),

  project: (overrides = {}) => ({
    id: 'project-123',
    name: 'Test Project',
    repo_url: 'https://github.com/test/repo',
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  model: (overrides = {}) => ({
    id: 'model-123',
    name: 'gpt-4',
    provider: 'openai',
    active: true,
    ...overrides,
  }),

  backup: (overrides = {}) => ({
    id: 'backup-123',
    created_at: new Date().toISOString(),
    note: 'Test backup',
    scope: 'data',
    ...overrides,
  }),

  gate: (overrides = {}) => ({
    id: 'gate-123',
    run_id: 'run-123',
    step_id: 'step-123',
    gate_type: 'manual',
    status: 'pending',
    ...overrides,
  }),
};