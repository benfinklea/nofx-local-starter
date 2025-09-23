import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { saveArtifact } from "../../lib/artifacts";
import { codegenReadme } from "../../tools/codegen";
import { getSettings } from "../../lib/settings";
import { getModelByName } from "../../lib/models";
import { log } from "../../lib/logger";

const handler: StepHandler = {
  match: (tool) => tool === 'codegen',
  async run({ runId, step }) {
    const stepId = step.id;
    const startedAt = new Date().toISOString();
    log.info({ runId, stepId, tool: step.tool }, 'codegen.step.starting');
    await store.updateStep(stepId, { status: 'running', started_at: startedAt });
    await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

    const inputs = step.inputs || {} as any;
    const filename = typeof inputs.filename === 'string' && inputs.filename.trim().length > 0 ? String(inputs.filename).trim() : 'README.md';

    log.debug({ runId, stepId, filename }, 'codegen.step.codegen.begin');
    const result = await codegenReadme(inputs || {});
    log.debug({ runId, stepId, provider: result.provider, model: result.model }, 'codegen.step.codegen.complete');

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

    log.debug({ runId, stepId, filename }, 'codegen.step.artifact.begin');
    const artifactName = filename;
    const pth = await saveArtifact(runId, stepId, artifactName, result.content, 'text/markdown');
    log.info({ runId, stepId, artifact: pth }, 'codegen.step.artifact.saved');

    await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs: { artifact: pth, provider: result.provider, model: result.model, usage: result.usage } });
    await recordEvent(runId, "step.finished", { artifact: pth, provider: result.provider, model: result.model, costUSD }, stepId);
  }
};
export default handler;
