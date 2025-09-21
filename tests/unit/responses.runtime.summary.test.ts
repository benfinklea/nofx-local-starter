import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetResponsesRuntime, getResponsesRuntime, getResponsesOperationsSummary } from '../../src/services/responses/runtime';

const originalArchiveDir = process.env.RESPONSES_ARCHIVE_DIR;
const originalMode = process.env.RESPONSES_RUNTIME_MODE;
const originalCost = process.env.RESPONSES_COST_PER_1K_TOKENS;
const originalRegions = process.env.RESPONSES_TENANT_REGIONS;

describe('Responses operations summary', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'responses-archive-'));
    process.env.RESPONSES_ARCHIVE_DIR = tmpDir;
    process.env.RESPONSES_RUNTIME_MODE = 'stub';
    process.env.RESPONSES_COST_PER_1K_TOKENS = '0.003';
    process.env.RESPONSES_TENANT_REGIONS = 'tenant-a:us-east,tenant-b:eu-west';
    resetResponsesRuntime();

    const runtime = getResponsesRuntime();
    await runtime.service.execute({
      tenantId: 'tenant-a',
      request: { model: 'gpt-4.1-mini', input: 'hello world' },
      metadata: { workflow: 'demo' },
    });
    await runtime.service.execute({
      tenantId: 'tenant-b',
      request: { model: 'gpt-4.1-mini', input: 'another run' },
      metadata: { workflow: 'demo' },
    });
  });

  afterEach(() => {
    resetResponsesRuntime();
    if (originalArchiveDir) {
      process.env.RESPONSES_ARCHIVE_DIR = originalArchiveDir;
    } else {
      delete process.env.RESPONSES_ARCHIVE_DIR;
    }
    if (originalMode) process.env.RESPONSES_RUNTIME_MODE = originalMode;
    else delete process.env.RESPONSES_RUNTIME_MODE;
    if (originalCost) process.env.RESPONSES_COST_PER_1K_TOKENS = originalCost;
    else delete process.env.RESPONSES_COST_PER_1K_TOKENS;
    if (originalRegions) process.env.RESPONSES_TENANT_REGIONS = originalRegions;
    else delete process.env.RESPONSES_TENANT_REGIONS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('includes estimated costs and region rollup', () => {
    const summary = getResponsesOperationsSummary();
    expect(summary.totalRuns).toBeGreaterThanOrEqual(2);
    expect(summary.totalEstimatedCost).toBeGreaterThan(0);
    const tenant = summary.tenantRollup.find((entry) => entry.tenantId === 'tenant-a');
    expect(tenant?.estimatedCost).toBeGreaterThan(0);
    expect(tenant?.regions).toContain('us-east');
  });
});
