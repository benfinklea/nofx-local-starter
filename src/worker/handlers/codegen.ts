import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { saveArtifact } from "../../lib/artifacts";
import { codegenReadme } from "../../tools/codegen";
import { getSettings } from "../../lib/settings";
import { getModelByName } from "../../lib/models";
import { log } from "../../lib/logger";
import { toJsonObject } from "../../lib/json";
import { AgentSdkAdapter } from "../../lib/agentSdk/adapter";

const handler: StepHandler = {
  match: (tool) => tool === 'codegen',
  async run({ runId, step }) {
    // Feature flag: optionally use Agent SDK instead of legacy model router
    const useAgentSdk = process.env.USE_AGENT_SDK === 'true';

    if (useAgentSdk) {
      log.info({ runId, stepId: step.id }, 'Using Agent SDK for codegen');
      return executeWithSdk(runId, step);
    } else {
      log.info({ runId, stepId: step.id }, 'Using legacy model router for codegen');
      return executeWithModelRouter(runId, step);
    }
  }
};

/**
 * NEW: Execute codegen using Agent SDK
 */
async function executeWithSdk(runId: string, step: any) {
  const stepId = step.id;
  const startedAt = new Date().toISOString();
  await store.updateStep(stepId, { status: 'running', started_at: startedAt });
  await recordEvent(runId, "step.started", { name: step.name, tool: step.tool }, stepId);

  try {
    const adapter = new AgentSdkAdapter();
    const inputs = step.inputs || {};
    const filename = typeof inputs.filename === 'string' && inputs.filename.trim().length > 0
      ? String(inputs.filename).trim()
      : 'README.md';

    const result = await adapter.executeWithSdk(step, {
      runId,
      model: inputs.model || process.env.AGENT_SDK_MODEL || 'claude-sonnet-4-5',
      sessionMemory: true,
      temperature: inputs.temperature || parseFloat(process.env.AGENT_SDK_TEMPERATURE || '0.7'),
      maxTokens: inputs.maxTokens || parseInt(process.env.AGENT_SDK_MAX_TOKENS || '4096', 10),
    });

    // Save artifact
    const artifactPath = await saveArtifact(runId, stepId, filename, result.response, 'text/markdown');
    log.info({ runId, stepId, artifact: artifactPath }, 'codegen.step.artifact.saved');

    const outputs = toJsonObject({
      artifact: artifactPath,
      provider: 'anthropic',
      model: result.metadata.model,
      usage: {
        totalTokens: result.metadata.tokensUsed,
        inputTokens: Math.floor(result.metadata.tokensUsed * 0.4),
        outputTokens: Math.floor(result.metadata.tokensUsed * 0.6),
      },
      costUSD: result.metadata.cost,
      sessionId: result.metadata.sessionId,
    });

    await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs });
    await recordEvent(runId, "step.finished", outputs, stepId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ error, runId, stepId }, 'Agent SDK codegen failed');

    await store.updateStep(stepId, {
      status: 'failed',
      outputs: { error: message },
      ended_at: new Date().toISOString()
    });
    await recordEvent(runId, "step.failed", { error: message }, stepId);
    throw error;
  }
}

/**
 * EXISTING: Execute codegen using legacy model router
 */
async function executeWithModelRouter(runId: string, step: any) {
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

    const outputs = toJsonObject({
      artifact: pth,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      costUSD,
    });

    await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs });
    await recordEvent(runId, "step.finished", outputs, stepId);
}

export default handler;
