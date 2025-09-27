process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { issueAdminCookie } from '../../src/lib/auth';

const builderDir = path.join(os.tmpdir(), `builder-api-${process.pid}-${Math.random().toString(16).slice(2)}`);
process.env.BUILDER_STORE_DIR = builderDir;
const responsesDir = path.join(os.tmpdir(), `responses-archive-${process.pid}-${Math.random().toString(16).slice(2)}`);
process.env.RESPONSES_ARCHIVE_DIR = responsesDir;
process.env.RESPONSES_RUNTIME_MODE = 'stub';

import { app } from '../../src/api/main';
import { resetResponsesRuntime } from '../../src/services/responses/runtime';

function builderDataPath() {
  return path.join(process.cwd(), 'local_data', 'builder', 'templates.json');
}

describe('Builder Templates API', () => {
  beforeEach(async () => {
    await fs.rm(builderDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(responsesDir, { recursive: true, force: true }).catch(() => {});
    resetResponsesRuntime();
  });

  it('returns seeded templates for operators', async () => {
    const cookie = issueAdminCookie();
    const res = await request(app).get('/builder/templates').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    const names = res.body.templates.map((t: any) => t.name);
    expect(names).toContain('Daily Focus Coach');
  });

  it('creates and updates templates with deployment toggles', async () => {
    const cookie = issueAdminCookie();
    const createRes = await request(app)
      .post('/builder/templates')
      .set('Cookie', cookie)
      .send({
        name: 'Energy Check',
        description: 'Recommend breaks based on energy signals',
        instructions: 'Provide two suggestions considering energy input.',
        input: [
          { id: 'energy', type: 'input_text', text: 'Energy: {{energy}}' },
        ],
        channels: { slack: false, email: true, inApp: true },
        model: 'gpt-4.1-mini',
      });
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.id;

    const deployRes = await request(app)
      .post(`/builder/templates/${templateId}/deploy`)
      .set('Cookie', cookie)
      .send({ environment: 'production', channel: 'slack', enabled: true });
    expect(deployRes.status).toBe(200);
    expect(deployRes.body.deployments.production.slack).toBe(true);
  });

  it('provides history timeline and compilation preview', async () => {
    const cookie = issueAdminCookie();
    const createRes = await request(app)
      .post('/builder/templates')
      .set('Cookie', cookie)
      .send({
        name: 'Meeting Sync',
        description: 'Plan sync agenda',
        instructions: 'Draft meeting plan with action items.',
        input: [
          { id: 'agenda', type: 'input_text', text: 'Agenda: {{agenda}}' },
          { id: 'notes', type: 'input_text', text: 'Notes: {{notes}}' },
        ],
        model: 'gpt-4.1-mini',
        channels: { slack: true, email: false, inApp: true },
      });
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.id;

    await request(app)
      .put(`/builder/templates/${templateId}`)
      .set('Cookie', cookie)
      .send({ description: 'Plan sync agenda with follow-ups' });

    const historyRes = await request(app)
      .get(`/builder/templates/${templateId}/history`)
      .set('Cookie', cookie);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history).toHaveLength(2);

    const compileRes = await request(app)
      .post(`/builder/templates/${templateId}/compile`)
      .set('Cookie', cookie)
      .send({
        tenantId: 'tenant-abc',
        variables: { agenda: 'Discuss roadmap', notes: 'Follow up on budget' },
      });
    expect(compileRes.status).toBe(200);
    expect(compileRes.body.request.model).toBe('gpt-4.1-mini');
    expect(compileRes.body.metadata.template_id).toBe(templateId);
  });

  it('executes a template via Responses API and archives events', async () => {
    const cookie = issueAdminCookie();
    const createRes = await request(app)
      .post('/builder/templates')
      .set('Cookie', cookie)
      .send({
        name: 'Focus Coach',
        description: 'Generate focus summary',
        instructions: 'Provide three focus areas.',
        input: [
          { id: 'notes', type: 'input_text', text: 'Notes: {{notes}}' },
        ],
        channels: { slack: false, email: true, inApp: true },
        model: 'gpt-4.1-mini',
      });
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.id;

    const runRes = await request(app)
      .post(`/builder/templates/${templateId}/run`)
      .set('Cookie', cookie)
      .send({ tenantId: 'tenant-test', variables: { notes: 'Daily standup review' } });

    expect(runRes.status).toBe(201);
    expect(runRes.body.runId).toMatch(/^run_/);

    const listRes = await request(app)
      .get('/responses/runs')
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.runs.length).toBeGreaterThan(0);

    const detailRes = await request(app)
      .get(`/responses/runs/${runRes.body.runId}`)
      .set('Cookie', cookie);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.events.some((event: any) => event.type === 'response.completed')).toBe(true);
    expect(Array.isArray(detailRes.body.bufferedMessages)).toBe(true);

    const retryRes = await request(app)
      .post(`/responses/runs/${runRes.body.runId}/retry`)
      .set('Cookie', cookie)
      .send({ metadata: { triggered_by_test: 'true' } });
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.runId).not.toBe(runRes.body.runId);

    const summaryRes = await request(app)
      .get('/responses/ops/summary')
      .set('Cookie', cookie);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalRuns).toBeGreaterThanOrEqual(2);

    // mark original run as stale and prune
    const runPath = path.join(responsesDir, runRes.body.runId, 'run.json');
    const runData = JSON.parse(await fs.readFile(runPath, 'utf8'));
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    runData.createdAt = oldDate;
    runData.updatedAt = oldDate;
    await fs.writeFile(runPath, JSON.stringify(runData, null, 2));

    const pruneRes = await request(app)
      .post('/responses/ops/prune')
      .set('Cookie', cookie)
      .send({ days: 5 });
    expect(pruneRes.status).toBe(200);
    expect(pruneRes.body.summary.totalRuns).toBe(1);
  });
});
