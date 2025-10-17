import request from 'supertest';
import express from 'express';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9 },
    llm: { order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] }, modelOrder: { docs: [], reasoning: [], codegen: [] } }
  }))
}));

function createApp(){
  const app = express();
  app.use(express.json());
  app.post('/runs/preview', async (req, res): Promise<void> => {
    try {
      const { standard } = req.body || {};
      if (!standard) {
        res.status(400).json({ error: 'missing standard' });
        return;
      }
      const { prompt, quality = true, openPr = false, summarizeQuery, summarizeTarget } = standard;
      const plan = await buildPlanFromPrompt(String(prompt||'').trim(), { quality, openPr, summarizeQuery, summarizeTarget } as any);
      res.json({ steps: plan.steps, plan });
    } catch (e:any) {
      res.status(400).json({ error: e.message || 'failed' });
    }
  });
  return app;
}

describe('POST /runs/preview', () => {
  let app: express.Application;
  beforeAll(() => { app = createApp(); });

  test('returns gates, codegen and PR from prompt', async () => {
    const rsp = await request(app).post('/runs/preview').send({ standard: { prompt: 'Write README and open a PR', quality: true, openPr: false } });
    expect(rsp.status).toBe(200);
    const tools = rsp.body.steps.map((s:any)=>s.tool);
    // Codegen comes first, then gates
    expect(tools[0]).toBe('codegen');
    expect(tools).toContain('gate:typecheck');
    expect(tools).toContain('gate:lint');
    expect(tools).toContain('gate:unit');
    const pr = rsp.body.steps.find((s:any)=>s.tool==='git_pr');
    expect(pr).toBeTruthy();
    expect(pr.inputs.reason).toBe('Prompt');
  });

  test('omits PR when neither prompt nor setting request it', async () => {
    const rsp = await request(app).post('/runs/preview').send({ standard: { prompt: 'Write README', quality: true, openPr: false } });
    expect(rsp.status).toBe(200);
    const tools = rsp.body.steps.map((s:any)=>s.tool);
    expect(tools).not.toContain('git_pr');
  });
});

