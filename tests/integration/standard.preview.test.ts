import request from 'supertest';
import app from '../../src/api/main';

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9 },
    llm: { order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] }, modelOrder: { docs: [], reasoning: [], codegen: [] } }
  }))
}));

describe('Standard interface preview', () => {
  test('returns gated plan with codegen and optional PR', async () => {
    const rsp = await request(app)
      .post('/runs/preview')
      .send({ standard: { prompt: 'Write README and open a PR', quality: true } })
      .set('Content-Type','application/json');
    expect(rsp.status).toBe(200);
    const tools = rsp.body.steps.map((s:any)=>s.tool);
    expect(tools.slice(0,3)).toEqual(['gate:typecheck','gate:lint','gate:unit']);
    expect(tools).toContain('codegen');
  });
});

