/**
 * Integration test for workspace:write handler
 * Verifies artifacts are correctly copied from runs/ to project workspace
 */

import { describe, it, expect } from '@jest/globals';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';

describe('workspace:write integration', () => {
  it('should add workspace:write step when projectId is provided', async () => {
    const plan = await buildPlanFromPrompt('Write a haiku about testing', {
      quality: false,
      openPr: false,
      projectId: 'test-project'
    });

    // Should have codegen step
    const codegenStep = plan.steps.find((s) => s.tool === 'codegen');
    expect(codegenStep).toBeDefined();
    expect(codegenStep?.name).toBe('write readme');

    // Should have workspace:write step
    const workspaceWriteStep = plan.steps.find((s) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeDefined();
    expect(workspaceWriteStep?.name).toBe('save to workspace');

    // Verify inputs - haiku prompts should now resolve to haiku.md
    expect(workspaceWriteStep?.inputs).toMatchObject({
      projectId: 'test-project',
      fromStep: 'write readme',
      artifactName: 'haiku.md',
      targetPath: 'haiku.md',
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
    const workspaceWriteStep = plan.steps.find((s) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeUndefined();
  });

  it('should NOT add workspace:write step when no projectId', async () => {
    const plan = await buildPlanFromPrompt('Write a haiku about testing', {
      quality: false,
      openPr: false
    });

    // Should not have workspace:write step
    const workspaceWriteStep = plan.steps.find((s) => s.tool === 'workspace:write');
    expect(workspaceWriteStep).toBeUndefined();
  });

  it('should use custom file path when provided', async () => {
    const plan = await buildPlanFromPrompt('Write docs', {
      quality: false,
      openPr: false,
      projectId: 'test-project',
      filePath: 'docs/custom.md'
    });

    const workspaceWriteStep = plan.steps.find((s) => s.tool === 'workspace:write');
    expect(workspaceWriteStep?.inputs?.targetPath).toBe('docs/custom.md');
    expect(workspaceWriteStep?.inputs?.artifactName).toBe('custom.md');
  });
});
