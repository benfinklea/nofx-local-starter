process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';

// Mock Supabase authentication BEFORE importing app
const mockGetUserFromRequest = jest.fn();
const mockVerifyApiKey = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
const mockGetUserTier = jest.fn().mockResolvedValue('free');

jest.mock('../../src/auth/supabase', () => ({
  getUserFromRequest: mockGetUserFromRequest,
  verifyApiKey: mockVerifyApiKey,
  createAuditLog: mockCreateAuditLog,
  getUserTier: mockGetUserTier,
  hasActiveSubscription: jest.fn().mockResolvedValue(true),
  createServiceClient: jest.fn()
}));

import request from 'supertest';
import { app } from '../../src/api/main';

describe('Projects API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default: authenticated state
    mockGetUserFromRequest.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'admin'
    });

    // Default: no API key
    mockVerifyApiKey.mockResolvedValue(null);
  });

  it('requires auth for listing projects', async () => {
    // Override mock to return null (unauthenticated) for this test only
    mockGetUserFromRequest.mockResolvedValue(null);
    mockVerifyApiKey.mockResolvedValue(null);

    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  it('lists projects with authentication', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    const ids = (res.body.projects || []).map((p: any) => p.id);
    expect(ids).toContain('default');
  });

  it('creates a local project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'LocalRepo', local_path: process.cwd(), workspace_mode: 'local_path' });
    expect([200,201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('LocalRepo');
  });
});
