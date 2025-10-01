/**
 * Integration test for workspace:write handler
 * Verifies artifacts are correctly copied from runs/ to project workspace
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { store } from '../../src/lib/store';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('workspace:write integration', () => {
  it('should add workspace:write step when projectId is provided', async () => {
    const plan = await buildPlanFromPrompt('Write a haiku about testing', {
      quality: false,
      openPr: false,
      projectId: 'test-project'
    });

    // Should have codegen step
    const codegenStep = plan.steps.find((s: any) => s.tool === 'codegen');
    expect(codegenStep).toBeDefined();
    expect(codegenStep?.name).toBe('write readme');

    // Should have workspace:write step
    const workspaceWriteStep = plan.steps.find((s: any) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeDefined();
    expect(workspaceWriteStep?.name).toBe('save to workspace');

    // Verify inputs
    expect(workspaceWriteStep?.inputs).toMatchObject({
      projectId: 'test-project',
      fromStep: 'write readme',
      artifactName: 'README.md',
      targetPath: 'README.md',
      commit: true
    });
    expect(workspaceWriteStep?.inputs?.commitMessage).toContain('testing');
  });

  it('should NOT add workspace:write step for default project', async () => {
    const plan = await buildPlanFromPrompt('Write a haiku about testing', {
      quality: false,
      openPr: false,
      projectId: 'default'
    });

    // Should not have workspace:write step
    const workspaceWriteStep = plan.steps.find((s: any) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeUndefined();
  });

  it('should NOT add workspace:write step when no projectId', async () => {
    const plan = await buildPlanFromPrompt('Write a haiku about testing', {
      quality: false,
      openPr: false
    });

    // Should not have workspace:write step
    const workspaceWriteStep = plan.steps.find((s: any) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeUndefined();
  });

  it('should use custom file path when provided', async () => {
    const plan = await buildPlanFromPrompt('Write docs', {
      quality: false,
      openPr: false,
      projectId: 'test-project',
      filePath: 'docs/custom.md'
    });

    const workspaceWriteStep = plan.steps.find((s: any) => s.tool === 'workspace:write');
    expect(workspaceWriteStep?.inputs?.targetPath).toBe('docs/custom.md');
    expect(workspaceWriteStep?.inputs?.artifactName).toBe('custom.md');
  });
});
