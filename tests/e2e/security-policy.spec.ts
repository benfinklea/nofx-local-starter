import { test, expect } from '@playwright/test';

test.describe('Security Policy Enforcement', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  test('denies disallowed tool and records event', async ({ request }) => {
    // Create a run with a step whose tools_allowed does NOT include its own tool
    const create = await request.post(`${API_URL}/runs`, {
      data: {
        plan: {
          goal: 'Test policy denial',
          steps: [
            { name: 'deny me', tool: 'codegen', tools_allowed: ['git_pr'] }
          ]
        }
      }
    });
    expect(create.ok()).toBeTruthy();
    const { id } = await create.json();
    expect(id).toBeTruthy();

    // Poll for failure
    let attempts = 0;
    let status = 'queued';
    while (attempts < 20 && status !== 'failed' && status !== 'succeeded') {
      await new Promise(r => setTimeout(r, 500));
      const rsp = await request.get(`${API_URL}/runs/${id}`);
      if (!rsp.ok()) continue;
      const data = await rsp.json();
      status = data.run?.status || status;
      attempts++;
    }
    expect(['failed','succeeded']).toContain(status);
    expect(status).toBe('failed');

    // Verify policy.denied event exists
    const evRsp = await request.get(`${API_URL}/runs/${id}/timeline`);
    expect(evRsp.ok()).toBeTruthy();
    const events = await evRsp.json();
    const hasPolicyDenied = Array.isArray(events) && events.some((e: any) => e.type === 'policy.denied');
    expect(hasPolicyDenied).toBeTruthy();
  });
});

