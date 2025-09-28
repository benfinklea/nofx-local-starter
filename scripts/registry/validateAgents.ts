import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateAgent } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';

const DEFAULT_AGENT_DIRS = [
  path.join(process.cwd(), 'packages', 'shared', 'agents'),
  path.join(process.cwd(), 'registry', 'agents')
];

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
    return definitions;
  }

  const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  return Array.isArray(data) ? data : [data];
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
    log.warn({ targets }, 'registry.validateAgents.cli.none');
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
