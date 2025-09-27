import type { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { GitValidationService } from "./git_ops/GitValidationService";
import { WorkspaceManagementService } from "./git_ops/WorkspaceManagementService";
import { HiddenModeService } from "./git_ops/HiddenModeService";
import { BasicModeService } from "./git_ops/BasicModeService";
import { AdvancedModeService } from "./git_ops/AdvancedModeService";

// Initialize services
const gitValidationService = new GitValidationService();
const workspaceManagementService = new WorkspaceManagementService();
const advancedModeService = new AdvancedModeService();
const basicModeService = new BasicModeService(advancedModeService);
const hiddenModeService = new HiddenModeService();

const handler: StepHandler = {
  match: (tool) => tool === 'git_ops',

  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    try {
      // Validate inputs
      const inputs = gitValidationService.validateInputs(step.inputs);

      // Setup workspace and git instance
      const { project, git, workspacePath } = await workspaceManagementService.setupWorkspace(inputs.project_id);

      // Execute operation based on git_mode
      const gitMode = project.git_mode || 'hidden';
      let result: any = {};

      switch (gitMode) {
        case 'hidden':
          result = await hiddenModeService.executeOperation(git, inputs, project);
          break;

        case 'basic':
          result = await basicModeService.executeOperation(git, inputs, project);
          break;

        case 'advanced':
          result = await advancedModeService.executeOperation(git, inputs, project);
          break;
      }

      const outputs = {
        operation: inputs.operation,
        git_mode: gitMode,
        workspace: workspacePath,
        ...result
      };

      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.finished', { outputs }, stepId);

    } catch (error) {
      const outputs = {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: (step.inputs as any)?.operation,
        project_id: (step.inputs as any)?.project_id
      };

      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.failed', { outputs, error: outputs.error }, stepId);
    }
  }
};




export default handler;