import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { codegenReadme } from "../../tools/codegen";

const handler: StepHandler = {
  match: (tool) => tool === 'codegen',
  async run({ runId, step }) {
    const stepId = step.id;
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId]);
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    const artifactContent = await codegenReadme(step.inputs || {});
    const artifactName = "README.md";
    const path = `runs/${runId}/steps/${stepId}/${artifactName}`;
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).upload(path, new Blob([artifactContent]), { upsert: true } as any);
    if (error) throw error;
    await query(`insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`, [
      stepId, "text/markdown", path, JSON.stringify({ tool: step.tool })
    ]);
    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      stepId, JSON.stringify({ artifact: path })
    ]);
    await recordEvent(runId, "step.finished", { artifact: path }, stepId);
  }
};
export default handler;