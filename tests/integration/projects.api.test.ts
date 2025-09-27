process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';
import request from 'supertest';
import { app } from '../../src/api/main';
import { issueAdminCookie } from '../../src/lib/auth';

describe('Projects API', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
  });

  it('requires auth for listing projects', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  it('lists projects with admin cookie', async () => {
    const cookie = issueAdminCookie();
    const res = await request(app).get('/projects').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    const ids = (res.body.projects || []).map((p: any) => p.id);
    expect(ids).toContain('default');
  });

  it('creates a local project', async () => {
    const cookie = issueAdminCookie();
    const res = await request(app)
      .post('/projects')
      .set('Cookie', cookie)
      .send({ name: 'LocalRepo', local_path: process.cwd(), workspace_mode: 'local_path' });
    expect([200,201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('LocalRepo');
  });
});
