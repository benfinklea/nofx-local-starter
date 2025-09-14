import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { codegenReadme } from "../../tools/codegen";
import { getSettings } from "../../lib/settings";
import { getModelByName } from "../../lib/models";

const handler: StepHandler = {
  match: (tool) => tool === 'codegen',
  async run({ runId, step }) {
    const stepId = step.id;
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId]);
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    const inputs = step.inputs || {} as any;
    const filename = typeof inputs.filename === 'string' && inputs.filename.trim().length > 0 ? String(inputs.filename).trim() : 'README.md';
    const result = await codegenReadme(inputs || {});
    let costUSD: number | undefined;
    if (result.usage) {
      const { llm } = await getSettings();
      const pricing = llm?.pricing || {};
      const p = (result.provider || '').toLowerCase();
      // Prefer model-specific pricing if defined
      let inP = 0, outP = 0;
      if (result.model) {
        const mr = await getModelByName(result.model);
        if (mr) {
          inP = Number(mr.input_per_1m) || 0;
          outP = Number(mr.output_per_1m) || 0;
        }
      }
      if (!inP && !outP) {
        const price = (pricing as any)[p] || {};
        inP = Number(price.inputPer1M) || 0;
        outP = Number(price.outputPer1M) || 0;
      }
      const inputTokens = result.usage.inputTokens || 0;
      const outputTokens = result.usage.outputTokens || 0;
      costUSD = (inputTokens/1000000)*inP + (outputTokens/1000000)*outP;
      await recordEvent(runId, 'llm.usage', { provider: result.provider, model: result.model, usage: result.usage, costUSD }, stepId);
    }
    if (result.usage) {
      await recordEvent(runId, 'llm.usage', { provider: result.provider, model: result.model, usage: result.usage }, stepId);
    }
    const artifactName = filename;
    const path = `runs/${runId}/steps/${stepId}/${artifactName}`;
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).upload(path, new Blob([result.content]), { upsert: true } as any);
    if (error) throw error;
    await query(`insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)`, [
      stepId, "text/markdown", path, JSON.stringify({ tool: step.tool })
    ]);
    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      stepId, JSON.stringify({ artifact: path, provider: result.provider, model: result.model, usage: result.usage })
    ]);
    await recordEvent(runId, "step.finished", { artifact: path, provider: result.provider, model: result.model, costUSD }, stepId);
  }
};
export default handler;
