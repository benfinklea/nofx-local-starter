import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { log } from "../../lib/logger";
import { getSettings } from "../../lib/settings";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId]);
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

    const proc = spawnSync(process.execPath, [scriptPath, gateName], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, COVERAGE_THRESHOLD: String(gates.coverageThreshold ?? 0.9) }
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
        const storagePath = `runs/${runId}/steps/${stepId}/gate-artifacts/${f}`;
        const fileBuf = fs.readFileSync(full);
        const { error } = await supabase.storage
          .from(ARTIFACT_BUCKET)
          .upload(storagePath, fileBuf as any, { upsert: true, contentType: contentTypeFor(f) } as any);
        if (!error) {
          uploadedPaths.push(storagePath);
          await query(
            `insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`,
            [stepId, contentTypeFor(f), storagePath, JSON.stringify({ gate: gateName })]
          ).catch(async () => {
            // fallback for schema with 'path' instead of 'uri'
            await query(
              `insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)`,
              [stepId, contentTypeFor(f), storagePath, JSON.stringify({ gate: gateName })]
            );
          });
        } else {
          log.error({ error, storagePath }, "gate artifact upload failed");
        }
      }
    }

    // Always upload a JSON summary as gate-summary.json
    const summaryName = "gate-summary.json";
    const summaryPath = `runs/${runId}/steps/${stepId}/${summaryName}`;
    const { error: summaryErr } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .upload(summaryPath, Buffer.from(JSON.stringify(summary, null, 2)), {
        upsert: true,
        contentType: "application/json",
      } as any);
    if (!summaryErr) {
      uploadedPaths.push(summaryPath);
      await query(
        `insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`,
        [stepId, "application/json", summaryPath, JSON.stringify({ gate: gateName, kind: "summary" })]
      ).catch(async () => {
        await query(
          `insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)`,
          [stepId, "application/json", summaryPath, JSON.stringify({ gate: gateName, kind: "summary" })]
        );
      });
    }

    if (summary.passed) {
      await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
        stepId,
        JSON.stringify({ gate: gateName, summary, artifacts: uploadedPaths })
      ]).catch(async () => {
        await query(`update nofx.step set status='succeeded', outputs=$2, completed_at=now() where id=$1`, [
          stepId,
          JSON.stringify({ gate: gateName, summary, artifacts: uploadedPaths })
        ]);
      });
      await recordEvent(runId, "step.finished", { gate: gateName, summary }, stepId);
    } else {
      await query(`update nofx.step set status='failed', outputs=$2, ended_at=now() where id=$1`, [
        stepId,
        JSON.stringify({ gate: gateName, summary, artifacts: uploadedPaths })
      ]).catch(async () => {
        await query(`update nofx.step set status='failed', outputs=$2, completed_at=now() where id=$1`, [
          stepId,
          JSON.stringify({ gate: gateName, summary, artifacts: uploadedPaths })
        ]);
      });
      await recordEvent(runId, "step.failed", { gate: gateName, summary, stderr: proc.stderr }, stepId);
      throw new Error(`gate ${gateName} failed`);
    }
  }
};

export default handler;
