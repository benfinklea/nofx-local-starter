import request from 'supertest';

// Mock authentication middleware to bypass auth checks
jest.mock('../../src/auth/middleware', () => ({
  requireAuth: jest.fn((req, res, next) => {
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

jest.mock('../../src/lib/db', () => ({
  query: jest.fn(async (sql: string, params?: any[]) => {
    if (/insert into nofx\.run/.test(sql)) {
      return { rows: [{ id: 'run-std-123' }] };
    }
    if (/insert into nofx\.step/.test(sql)) {
      return { rows: [{ id: 'step-abc' }] };
    }
    if (/select \*/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  })
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn(async () => undefined),
  STEP_READY_TOPIC: 'step.ready'
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn(async () => undefined)
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn(() => ({ upload: jest.fn().mockResolvedValue({ error: null }) })) } },
  ARTIFACT_BUCKET: 'artifacts'
}));

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9 },
    llm: { order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] }, modelOrder: { docs: [], reasoning: [], codegen: [] } }
  }))
}));

import { app } from '../../src/api/main';

describe('POST /runs (standard)', () => {
  test('builds plan from standard prompt and enqueues steps', async () => {
    const rsp = await request(app)
      .post('/runs')
      .set('Content-Type','application/json')
      .send({ standard: { prompt: 'Write README with bullets', quality: true, openPr: false } });
    expect(rsp.status).toBe(201);
    expect(rsp.body).toEqual(expect.objectContaining({ status: 'queued', projectId: 'default' }));
    expect(typeof rsp.body.id).toBe('string');
  });
});
