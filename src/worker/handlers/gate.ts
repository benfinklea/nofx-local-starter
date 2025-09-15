import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { log } from "../../lib/logger";
import { getSettings } from "../../lib/settings";
import { saveArtifact } from "../../lib/artifacts";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { query } from "../../lib/db";
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

    const scriptPath = path.resolve(process.cwd(), "scripts", "runGate.js");
    const { gates } = await getSettings();

    // Skip if gate disabled by settings
    if ((gateName === 'typecheck' && !gates.typecheck) ||
        (gateName === 'lint' && !gates.lint) ||
        (gateName === 'unit' && !gates.unit)) {
      await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
        stepId,
        JSON.stringify({ gate: gateName, skipped: true })
      ]).catch(async () => {
        await query(`update nofx.step set status='succeeded', outputs=$2, completed_at=now() where id=$1`, [
          stepId,
          JSON.stringify({ gate: gateName, skipped: true })
        ]);
      });
      await recordEvent(runId, "step.finished", { gate: gateName, skipped: true }, stepId);
      return;
    }

    const policy = (step.inputs && (step.inputs as any)._policy) || {};
    const envAllowed: string[] | undefined = policy.env_allowed;
    const baseEnv = buildMinimalEnv(envAllowed);
    const proc = spawnSync(process.execPath, [scriptPath, gateName], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...baseEnv, COVERAGE_THRESHOLD: String(gates.coverageThreshold ?? 0.9) }
    });

    let summary: any = { gate: gateName, passed: proc.status === 0 };
    try {
      const line = (proc.stdout || "").trim().split(/\n/).filter(Boolean).pop();
      if (line) {
        const parsed = JSON.parse(line);
        if (parsed && parsed.summary) summary = parsed.summary;
      }
    } catch (e) {
      // keep default summary
    }

    // Collect and upload evidence artifacts produced by the gate runner
    const localDir = path.resolve(process.cwd(), "gate-artifacts");
    const uploadedPaths: string[] = [];
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      for (const f of files) {
        const full = path.join(localDir, f);
        if (!fs.statSync(full).isFile()) continue;
        const storagePath = await saveArtifact(runId, stepId, `gate-artifacts/${f}`, fs.readFileSync(full, 'utf8'), contentTypeFor(f));
        uploadedPaths.push(storagePath);
      }
    }

    // Always upload a JSON summary as gate-summary.json
    const summaryName = "gate-summary.json";
    const summaryPath = await saveArtifact(runId, stepId, summaryName, JSON.stringify(summary, null, 2), 'application/json');
    uploadedPaths.push(summaryPath);

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
