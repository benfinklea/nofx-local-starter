import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { publishAgent } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';

const DEFAULT_AGENT_DIRS = [
  path.join(process.cwd(), 'packages', 'shared', 'agents'),
  path.join(process.cwd(), 'registry', 'agents')
];

const dryRun = process.env.REGISTRY_DRY_RUN === '1';

async function loadDefinitions(targetPath: string): Promise<PublishAgentRequest[]> {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const definitions: PublishAgentRequest[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(targetPath, entry.name, 'agent.json');
        try {
          const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          definitions.push(data as PublishAgentRequest);
        } catch {
          // ignore directories without an agent.json file
        }
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      const full = path.join(targetPath, entry.name);
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
  const override = process.argv[2];
  const targets = override ? [override] : DEFAULT_AGENT_DIRS.filter(existsSync);
  const definitions: PublishAgentRequest[] = [];

  for (const target of targets) {
    const loaded = await loadDefinitions(target);
    definitions.push(...loaded);
  }

  if (definitions.length === 0) {
    console.warn('No agent definitions found in', targets.join(', '));
    return;
  }

  for (const def of definitions) {
    try {
      log.info({ agentId: def.agentId, version: def.version, dryRun }, 'registry.publishAgents.cli.start');
      if (dryRun) {
        log.info({ agentId: def.agentId, version: def.version }, 'registry.publishAgents.cli.dryRun');
        continue;
      }
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
