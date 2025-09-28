import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { publishAgent, validateAgent, publishTemplate, validateTemplate } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';

const DEFAULT_AGENT_PATHS = [
  path.join(process.cwd(), 'packages', 'shared', 'agents'),
  path.join(process.cwd(), 'registry', 'agents')
];

const DEFAULT_TEMPLATE_PATHS = [
  path.join(process.cwd(), 'packages', 'shared', 'templates'),
  path.join(process.cwd(), 'registry', 'templates')
];

const dryRun = process.env.REGISTRY_DRY_RUN === '1';

async function loadJsonRecords<T>(targetPath: string, manifestFile: string): Promise<T[]> {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const records: T[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(targetPath, entry.name, manifestFile);
          try {
            const payload = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            records.push(payload as T);
          } catch {
            // ignore directories without a manifest file
          }
          continue;
        }
        if (!entry.name.endsWith('.json')) continue;
        const full = path.join(targetPath, entry.name);
        const payload = JSON.parse(await fs.readFile(full, 'utf8'));
        records.push(payload as T);
      }
      return records;
    }
    const payload = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    return Array.isArray(payload) ? payload : [payload];
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function collectDefinitions<T>(targets: string[], manifestFile: string): Promise<T[]> {
  const records: T[] = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    const payloads = await loadJsonRecords<T>(target, manifestFile);
    records.push(...payloads);
  }
  return records;
}

async function main() {
  const override = process.argv[2];
  const agentTargets = override ? [path.join(override, 'agents')] : DEFAULT_AGENT_PATHS;
  const templateTargets = override ? [path.join(override, 'templates')] : DEFAULT_TEMPLATE_PATHS;

  const agents = await collectDefinitions<PublishAgentRequest>(agentTargets, 'agent.json');
  const templates = await collectDefinitions<PublishTemplateRequest>(templateTargets, 'template.json');

  if (agents.length === 0 && templates.length === 0) {
    log.warn({ agentTargets, templateTargets }, 'registry.sync.cli.none');
    return;
  }

  let failures = 0;

  for (const agent of agents) {
    const check = await validateAgent(agent);
    if (!check.valid) {
      failures += 1;
      log.error({ agentId: agent.agentId, errors: check.errors }, 'registry.sync.cli.agent.invalid');
      continue;
    }
    try {
      if (dryRun) {
        log.info({ agentId: agent.agentId, version: agent.version }, 'registry.sync.cli.agent.dryRun');
        continue;
      }
      const result = await publishAgent(agent);
      log.info({ agentId: result.agentId, version: result.currentVersion }, 'registry.sync.cli.agent.published');
    } catch (err) {
      failures += 1;
      log.error({ agentId: agent.agentId, err }, 'registry.sync.cli.agent.failure');
    }
  }

  for (const template of templates) {
    const check = await validateTemplate(template);
    if (!check.valid) {
      failures += 1;
      log.error({ templateId: template.templateId, errors: check.errors }, 'registry.sync.cli.template.invalid');
      continue;
    }
    try {
      if (dryRun) {
        log.info({ templateId: template.templateId, version: template.version }, 'registry.sync.cli.template.dryRun');
        continue;
      }
      const result = await publishTemplate(template);
      log.info({
        templateId: result.templateId,
        version: result.currentVersion,
        ratingAverage: result.ratingAverage,
        ratingCount: result.ratingCount,
        usageCount30d: result.analytics?.usageCount30d,
        successRate30d: result.analytics?.successRate30d
      }, 'registry.sync.cli.template.published');
    } catch (err) {
      failures += 1;
      log.error({ templateId: template.templateId, err }, 'registry.sync.cli.template.failure');
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  log.error({ err }, 'registry.sync.cli.fatal');
  process.exit(1);
});
