import request from 'supertest';
process.env.UI_RESPONSES_UI_MODE = 'mui';
process.env.UI_RUNS_UI_MODE = 'mui';
process.env.UI_SETTINGS_UI_MODE = 'true';

const { app } = require('../../src/api/main');
const { issueAdminCookie } = require('../../src/lib/auth');

describe('Responses UI redirection', () => {
  const originalResponsesMode = process.env.UI_RESPONSES_UI_MODE;
  const originalRunsMode = process.env.UI_RUNS_UI_MODE;
  const originalSettingsMode = process.env.UI_SETTINGS_UI_MODE;

  afterAll(() => {
    process.env.UI_RESPONSES_UI_MODE = originalResponsesMode;
    process.env.UI_RUNS_UI_MODE = originalRunsMode;
    process.env.UI_SETTINGS_UI_MODE = originalSettingsMode;
  });

  it('redirects legacy responses list to the React app when flag enabled', async () => {
    const cookie = issueAdminCookie().split(';')[0];
    const res = await request(app).get('/ui/responses').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/responses');
  });

  it('redirects run detail to the React app when flag enabled', async () => {
    const cookie = issueAdminCookie().split(';')[0];
    const res = await request(app).get('/ui/responses/run-123').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/responses/run-123');
  });

  it('redirects runs list to the React app when flag enabled', async () => {
    const res = await request(app).get('/ui/runs');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/runs');
  });

  it('redirects run creation page to the React app when flag enabled', async () => {
    const res = await request(app).get('/ui/runs/new');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/runs/new');
  });

  it('redirects run detail to the React app when flag enabled', async () => {
    const res = await request(app).get('/ui/runs/run-456');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/runs/run-456');
  });

  it('redirects settings to the React app when flag enabled', async () => {
    const cookie = issueAdminCookie().split(';')[0];
    const res = await request(app).get('/ui/settings').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/settings');
  });

  it('redirects models to the React app when flag enabled', async () => {
    const cookie = issueAdminCookie().split(';')[0];
    const res = await request(app).get('/ui/models').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/app/#/models');
  });
});
