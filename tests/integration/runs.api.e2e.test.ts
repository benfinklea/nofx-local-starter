process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';
process.env.LOAD_ALL_HANDLERS = '1';

// Mock authentication middleware to bypass auth checks
jest.mock('../../src/auth/middleware', () => ({
  requireAuth: jest.fn((req, res, next) => {
    // Mock authenticated user for tests
    req.userId = 'test-user-id';
    req.userTier = 'free';
    next();
  }),
  optionalAuth: jest.fn((_req, _res, next) => next()),
  checkUsage: jest.fn(() => jest.fn((_req, _res, next) => next())),
  rateLimit: jest.fn(() => jest.fn((_req, _res, next) => next())),
  trackApiUsage: jest.fn(() => jest.fn((_req, _res, next) => next())),
  requireTeamAccess: jest.fn(() => jest.fn((_req, _res, next) => next())),
  requireAdmin: jest.fn((_req, _res, next) => next()),
  requireSubscription: jest.fn((_req, _res, next) => next()),
  validateOwnership: jest.fn(() => jest.fn((_req, _res, next) => next())),
}));

import request from 'supertest';
import { app } from '../../src/api/main';
import { issueAdminCookie } from '../../src/lib/auth';

describe('Runs API with project context', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
  });

  it('creates a run using standard body and x-project-id', async () => {
    const cookie = issueAdminCookie();
    // ensure a project exists
    const pj = await request(app).post('/projects').set('Cookie', cookie).send({ name: 'ProjA', local_path: process.cwd(), workspace_mode: 'local_path' });
    const projectId = pj.body.id || 'default';
    const res = await request(app)
      .post('/runs')
      .set('Cookie', cookie)
      .set('x-project-id', projectId)
      .send({ standard: { prompt: 'Write a small README about NOFX', quality: false, openPr: false } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const id = res.body.id;
    const got = await request(app).get(`/runs/${id}`).set('Cookie', cookie);
    expect(got.status).toBe(200);
    expect(got.body).toHaveProperty('id');
    expect(got.body.id).toBe(id);
  });

  it('lists runs filtered by project', async () => {
    const res = await request(app).get('/runs?limit=5&projectId=default');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
  });
});
