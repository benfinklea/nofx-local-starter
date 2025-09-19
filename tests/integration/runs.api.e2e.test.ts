process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';
process.env.LOAD_ALL_HANDLERS = '1';
import request from 'supertest';
import app from '../../src/api/main';
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
      .set('x-project-id', projectId)
      .send({ standard: { prompt: 'Write a small README about NOFX', quality: false, openPr: false } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const id = res.body.id;
    const got = await request(app).get(`/runs/${id}`);
    expect(got.status).toBe(200);
    expect(got.body).toHaveProperty('run');
  });

  it('lists runs filtered by project', async () => {
    const res = await request(app).get('/runs?limit=5&projectId=default');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
  });
});
