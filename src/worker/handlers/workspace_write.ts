/**
 * workspace:write - Copy artifacts from runs/ to project workspace
 *
 * This handler takes generated artifacts (code, docs, etc.) and copies them
 * to the actual project workspace, optionally committing to git.
 */

import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { log } from "../../lib/logger";
import { getProject } from "../../lib/projects";
import { WorkspaceManager } from "../../lib/workspaces";
import path from "node:path";
import fs from "node:fs/promises";
import simpleGit from 'simple-git';

const handler: StepHandler = {
  match: (tool) => tool === 'workspace:write',
  async run({ runId, step }) {
    const stepId = step.id;
    const startedAt = new Date().toISOString();

    await store.updateStep(stepId, { status: 'running', started_at: startedAt });
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    try {
      const inputs = step.inputs || {};

      // Required inputs
      const projectId = typeof inputs.projectId === 'string' ? inputs.projectId : null;
      const targetPath = typeof inputs.targetPath === 'string' ? inputs.targetPath : null;

      // Source can be either direct path or fromStep + artifactName
      const sourceArtifact = typeof inputs.sourceArtifact === 'string' ? inputs.sourceArtifact : null;
      const fromStep = typeof inputs.fromStep === 'string' ? inputs.fromStep : null;
      const artifactName = typeof inputs.artifactName === 'string' ? inputs.artifactName : null;

      if (!projectId) {
        throw new Error('workspace:write requires projectId in inputs');
      }
      if (!targetPath) {
        throw new Error('workspace:write requires targetPath in inputs');
      }
      if (!sourceArtifact && !(fromStep && artifactName)) {
        throw new Error('workspace:write requires either sourceArtifact or (fromStep + artifactName)');
      }

      // Optional inputs
      const commit = inputs.commit === true;
      const commitMessage = typeof inputs.commitMessage === 'string'
        ? inputs.commitMessage
        : 'Update from NOFX run';

      log.info({ runId, stepId, projectId, targetPath, fromStep, artifactName }, 'workspace:write.starting');

      // Resolve source artifact path
      let sourcePath: string;
      if (sourceArtifact) {
        sourcePath = path.join(process.cwd(), 'local_data', sourceArtifact);
      } else if (fromStep && artifactName) {
        // Look up artifact from previous step
        const steps = await store.listStepsByRun(runId);
        const artifacts = await store.listArtifactsByRun(runId);

        const stepRow = steps.find(s => s.name === fromStep);
        if (!stepRow) {
          throw new Error(`Step not found: ${fromStep}`);
        }

        const artifact = artifacts.find(a => a.step_id === stepRow.id && String(a.path || '').endsWith(`/${artifactName}`));
        if (!artifact) {
          throw new Error(`Artifact not found: ${artifactName} in step ${fromStep}`);
        }

        sourcePath = path.join(process.cwd(), 'local_data', artifact.path);
      } else {
        throw new Error('Invalid source specification');
      }

      // Get project and workspace
      const project = await getProject(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const workspaceManager = new WorkspaceManager();
      const workspacePath = await workspaceManager.ensureWorkspace(project);

      log.info({ runId, stepId, workspacePath, sourcePath }, 'workspace:write.workspace_ready');

      // Read source artifact
      let content: string;
      try {
        content = await fs.readFile(sourcePath, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to read source artifact: ${sourcePath}. ${error}`);
      }

      // Write to workspace
      const targetFullPath = path.join(workspacePath, targetPath);
      const targetDir = path.dirname(targetFullPath);

      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetFullPath, content, 'utf-8');

      log.info({ runId, stepId, targetFullPath }, 'workspace:write.file_written');

      // Optional: Git commit
      let commitSha: string | undefined;
      if (commit) {
        try {
          const git = simpleGit(workspacePath);

          // Check if this is a git repository
          const isRepo = await git.checkIsRepo();
          if (!isRepo) {
            log.warn({ runId, stepId, workspacePath }, 'workspace:write.not_a_git_repo');
          } else {
            // Add file
            await git.add(targetPath);

            // Check if there are changes to commit
            const status = await git.status();
            if (status.files.length > 0) {
              // Create commit
              const result = await git.commit(commitMessage);
              commitSha = result.commit;

              log.info({ runId, stepId, commitSha, targetPath }, 'workspace:write.committed');
            } else {
              log.info({ runId, stepId }, 'workspace:write.no_changes_to_commit');
            }
          }
        } catch (gitError) {
          // Log git error but don't fail the step
          log.warn({ runId, stepId, error: gitError }, 'workspace:write.git_commit_failed');
        }
      }

      const outputs = {
        workspacePath,
        targetPath,
        targetFullPath,
        commit,
        commitSha,
        bytesWritten: Buffer.byteLength(content, 'utf-8')
      };

      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs
      });

      await recordEvent(runId, "step.finished", outputs, stepId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ error, runId, stepId }, 'workspace:write.failed');

      await store.updateStep(stepId, {
        status: 'failed',
        outputs: { error: message },
        ended_at: new Date().toISOString()
      });

      await recordEvent(runId, "step.failed", { error: message }, stepId);
    }
  }
};

export default handler;
