import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAgent } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';

async function loadDefinitions(targetPath: string): Promise<PublishAgentRequest[]> {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    const files = await fs.readdir(targetPath);
    const definitions: PublishAgentRequest[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(targetPath, file);
      const data = JSON.parse(await fs.readFile(full, 'utf8'));
      definitions.push(data as PublishAgentRequest);
    }
    return definitions;
  }

  const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  return Array.isArray(data) ? data : [data];
}

async function main() {
  const target = process.argv[2] ?? path.join(process.cwd(), 'registry', 'agents');
  const definitions = await loadDefinitions(target);
  if (definitions.length === 0) {
    log.warn({ target }, 'registry.validateAgents.cli.none');
    return;
  }

  let failures = 0;

  for (const def of definitions) {
    const result = await validateAgent(def);
    if (result.valid) {
      log.info({ agentId: def.agentId }, 'registry.validateAgents.cli.valid');
    } else {
      failures += 1;
      log.error({ agentId: def.agentId, errors: result.errors }, 'registry.validateAgents.cli.invalid');
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  log.error({ err }, 'registry.validateAgents.cli.fatal');
  process.exit(1);
});
