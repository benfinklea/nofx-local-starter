import fs from 'node:fs/promises';
import path from 'node:path';
import { publishAgent } from '../../src/lib/registry';
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
    log.info({ targetPath, count: definitions.length }, 'registry.publishAgents.cli.directory');
    return definitions;
  }

  const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  const definitions = Array.isArray(data) ? data : [data];
  log.info({ targetPath, count: definitions.length }, 'registry.publishAgents.cli.file');
  return definitions;
}

async function main() {
  const target = process.argv[2] ?? path.join(process.cwd(), 'registry', 'agents');
  const definitions = await loadDefinitions(target);
  if (definitions.length === 0) {
    console.warn('No agent definitions found at', target);
    return;
  }

  for (const def of definitions) {
    try {
      log.info({ agentId: def.agentId, version: def.version }, 'registry.publishAgents.cli.start');
      const result = await publishAgent(def);
      log.info({ agentId: result.agentId, version: result.currentVersion }, 'registry.publishAgents.cli.success');
    } catch (err) {
      log.error({ agentId: def.agentId, version: def.version, err }, 'registry.publishAgents.cli.failure');
      process.exitCode = 1;
    }
  }
}

main().catch(err => {
  log.error({ err }, 'registry.publishAgents.cli.fatal');
  process.exit(1);
});
