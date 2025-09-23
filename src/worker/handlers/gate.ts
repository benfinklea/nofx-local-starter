import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { log } from "../../lib/logger";
import { getSettings } from "../../lib/settings";
import { saveArtifact } from "../../lib/artifacts";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildMinimalEnv } from "../../lib/secrets";

function contentTypeFor(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".txt" || ext === ".log") return "text/plain";
  return "application/octet-stream";
}

const handler: StepHandler = {
  match: (tool) => tool.startsWith("gate:"),
  async run({ runId, step }) {
    const stepId = step.id;
    const gateName = step.tool.replace(/^gate:/, "");

    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    const scriptPath = path.resolve(process.cwd(), "scripts", "runGate.mjs");
    if (!fs.existsSync(scriptPath)) {
      log.error({ scriptPath }, 'Gate runner script not found');
      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs: { gate: gateName, error: 'Gate runner script not found' }
      });
      throw new Error(`Gate runner script not found: ${scriptPath}`);
    }

    const { gates } = await getSettings();

    // Skip if gate disabled by settings
    const isGateEnabled = gates[gateName as keyof typeof gates];
    if (isGateEnabled === false) {
      log.info({ gateName, settings: gates }, `Gate ${gateName} disabled by settings`);
      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs: { gate: gateName, skipped: true }
      });
      await recordEvent(runId, "step.finished", { gate: gateName, skipped: true }, stepId);
      return;
    }

    const policy = (step.inputs && (step.inputs as any)._policy) || {};
    const envAllowed: string[] | undefined = policy.env_allowed;
    const baseEnv = buildMinimalEnv(envAllowed);
    const proc = spawnSync('npx', ['zx', scriptPath, gateName], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...baseEnv, COVERAGE_THRESHOLD: String(gates.coverageThreshold ?? 0.9) },
      timeout: 600000 // 10 minutes timeout
    });

    // Check if process was killed due to timeout
    if (proc.signal === 'SIGTERM') {
      const summary = { gate: gateName, passed: false, error: 'Gate execution timed out after 10 minutes' };
      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs: { gate: gateName, summary }
      });
      await recordEvent(runId, "step.failed", { gate: gateName, summary, stderr: 'Timeout' }, stepId);
      throw new Error(`Gate ${gateName} timed out`);
    }

    let summary: any = { gate: gateName, passed: proc.status === 0 };
    try {
      const line = (proc.stdout || "").trim().split(/\n/).filter(Boolean).pop();
      if (line) {
        const parsed = JSON.parse(line);
        if (parsed && parsed.summary) summary = parsed.summary;
      }
    } catch (e) {
      log.warn({
        stdout: proc.stdout,
        stderr: proc.stderr,
        error: String(e)
      }, `Failed to parse gate output for ${gateName}`);
      // keep default summary
    }

    // Collect and upload evidence artifacts produced by the gate runner
    const localDir = path.resolve(process.cwd(), "gate-artifacts");
    const lockFile = path.join(localDir, '.lock');
    const uploadedPaths: string[] = [];

    // Simple file-based locking to prevent concurrent artifact access
    let lockAcquired = false;
    try {
      if (fs.existsSync(localDir)) {
        // Wait for existing lock to be released (up to 30 seconds)
        for (let i = 0; i < 30 && fs.existsSync(lockFile); i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Create lock file
        fs.writeFileSync(lockFile, stepId);
        lockAcquired = true;

        const files = fs.readdirSync(localDir).filter(f => f !== '.lock');
        for (const f of files) {
          const full = path.join(localDir, f);
          if (!fs.statSync(full).isFile()) continue;

          const contentType = contentTypeFor(f);
          const fileData = contentType.startsWith('text/') || contentType === 'application/json'
            ? fs.readFileSync(full, 'utf8')
            : fs.readFileSync(full).toString('base64'); // Read as Buffer and convert to base64 for binary files

          const storagePath = await saveArtifact(runId, stepId, `gate-artifacts/${f}`, fileData, contentType);
          if (storagePath) {
            uploadedPaths.push(storagePath);
          } else {
            log.warn({ file: f, contentType }, 'Failed to upload artifact - saveArtifact returned null/undefined');
          }
        }

        // Clean up local artifacts after upload
        try {
          for (const f of files) {
            const full = path.join(localDir, f);
            try {
              if (fs.existsSync(full) && fs.statSync(full).isFile()) {
                fs.unlinkSync(full);
              }
            } catch (fileError) {
              log.warn({ file: full, error: String(fileError) }, 'Failed to delete artifact file');
            }
          }
          // Remove directory if empty (excluding lock file)
          try {
            const remainingFiles = fs.readdirSync(localDir).filter(f => f !== '.lock');
            if (remainingFiles.length === 0) {
              fs.rmdirSync(localDir);
            }
          } catch (dirError) {
            log.warn({ directory: localDir, error: String(dirError) }, 'Failed to remove artifacts directory');
          }
        } catch (e) {
          log.warn({ error: String(e) }, 'Failed to clean up gate artifacts directory');
        }
      }
    } finally {
      // Always release lock
      if (lockAcquired && fs.existsSync(lockFile)) {
        try {
          fs.unlinkSync(lockFile);
        } catch (e) {
          log.warn({ lockFile, error: String(e) }, 'Failed to release lock file');
        }
      }
    }

    // Always upload a JSON summary as gate-summary.json
    const summaryName = "gate-summary.json";
    const summaryPath = await saveArtifact(runId, stepId, summaryName, JSON.stringify(summary, null, 2), 'application/json');
    if (summaryPath) {
      uploadedPaths.push(summaryPath);
    } else {
      log.warn({ summaryName }, 'Failed to upload summary artifact - saveArtifact returned null/undefined');
    }

    if (summary.passed) {
      await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs: { gate: gateName, summary, artifacts: uploadedPaths } });
      await recordEvent(runId, "step.finished", { gate: gateName, summary }, stepId);
    } else {
      await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs: { gate: gateName, summary, artifacts: uploadedPaths } });
      await recordEvent(runId, "step.failed", { gate: gateName, summary, stderr: proc.stderr }, stepId);
      throw new Error(`gate ${gateName} failed`);
    }
  }
};

export default handler;
