import type { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { spawn } from "node:child_process";

const handler: StepHandler = {
  match: (tool) => tool === 'bash',
  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    try {
      const command = step.inputs?.command || 'echo "No command provided"';
      const cwd = step.inputs?.cwd || process.cwd();
      const timeout = step.inputs?.timeout || 30000; // 30 second default timeout

      const result = await runBashCommand(command, { cwd, timeout });

      const outputs = {
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.exitCode === 0
      };

      if (result.exitCode === 0) {
        await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs });
        await recordEvent(runId, 'step.finished', { outputs }, stepId);
      } else {
        await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs });
        await recordEvent(runId, 'step.failed', { outputs, error: `Command failed with exit code ${result.exitCode}` }, stepId);
      }
    } catch (error) {
      const outputs = {
        error: error instanceof Error ? error.message : 'Unknown error',
        command: step.inputs?.command
      };
      await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs });
      await recordEvent(runId, 'step.failed', { outputs, error: outputs.error }, stepId);
    }
  }
};

function runBashCommand(command: string, options: { cwd: string; timeout: number }): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout);

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export default handler;