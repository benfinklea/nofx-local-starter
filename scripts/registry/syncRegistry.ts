import fs from 'node:fs/promises';
import path from 'node:path';
import { publishAgent, validateAgent, publishTemplate, validateTemplate } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';

async function loadJsonRecords<T>(targetPath: string): Promise<T[]> {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      const files = await fs.readdir(targetPath);
      const records: T[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const full = path.join(targetPath, file);
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

async function main() {
  const baseDir = process.argv[2] ?? path.join(process.cwd(), 'registry');
  const agentPath = path.join(baseDir, 'agents');
  const templatePath = path.join(baseDir, 'templates');

  const agents = await loadJsonRecords<PublishAgentRequest>(agentPath);
  const templates = await loadJsonRecords<PublishTemplateRequest>(templatePath);

  if (agents.length === 0 && templates.length === 0) {
    log.warn({ baseDir }, 'registry.sync.cli.none');
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
      const result = await publishTemplate(template);
      log.info({ templateId: result.templateId, version: result.currentVersion }, 'registry.sync.cli.template.published');
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
