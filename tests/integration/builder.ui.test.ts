process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { issueAdminCookie } from '../../src/lib/auth';

const builderDir = path.join(os.tmpdir(), `builder-ui-${process.pid}-${Math.random().toString(16).slice(2)}`);
process.env.BUILDER_STORE_DIR = builderDir;
const responsesDir = path.join(os.tmpdir(), `responses-ui-${process.pid}-${Math.random().toString(16).slice(2)}`);
process.env.RESPONSES_ARCHIVE_DIR = responsesDir;
process.env.RESPONSES_RUNTIME_MODE = 'stub';

import app from '../../src/api/main';
import { resetResponsesRuntime } from '../../src/services/responses/runtime';

describe('Builder UI', () => {
  beforeEach(async () => {
    await fs.rm(builderDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(responsesDir, { recursive: true, force: true }).catch(() => {});
    resetResponsesRuntime();
  });

  it('renders builder view with seeded templates', async () => {
    const res = await request(app).get('/ui/builder').set('Cookie', issueAdminCookie());
    expect(res.status).toBe(200);
    expect(res.text).toContain('Agent Builder');
    expect(res.text).toContain('Daily Focus Coach');
    expect(res.text).toContain('Recent Responses Runs');
  });

  it('redirects non-admin users to login', async () => {
    const res = await request(app).get('/ui/builder');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/ui/login');
  });
});
