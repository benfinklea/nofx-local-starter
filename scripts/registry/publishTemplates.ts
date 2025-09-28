import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { publishTemplate } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';

const DEFAULT_TEMPLATE_DIRS = [
  path.join(process.cwd(), 'packages', 'shared', 'templates'),
  path.join(process.cwd(), 'registry', 'templates')
];

const dryRun = process.env.REGISTRY_DRY_RUN === '1';

async function loadDefinitions(targetPath: string): Promise<PublishTemplateRequest[]> {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const definitions: PublishTemplateRequest[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(targetPath, entry.name, 'template.json');
        try {
          const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          definitions.push(data as PublishTemplateRequest);
        } catch {
          // ignore directories missing template.json
        }
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      const full = path.join(targetPath, entry.name);
      const data = JSON.parse(await fs.readFile(full, 'utf8'));
      definitions.push(data as PublishTemplateRequest);
    }
    log.info({ targetPath, count: definitions.length }, 'registry.publishTemplates.cli.directory');
    return definitions;
  }

  const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  const definitions = Array.isArray(data) ? data : [data];
  log.info({ targetPath, count: definitions.length }, 'registry.publishTemplates.cli.file');
  return definitions;
}

async function main() {
  const override = process.argv[2];
  const targets = override ? [override] : DEFAULT_TEMPLATE_DIRS.filter(existsSync);
  const definitions: PublishTemplateRequest[] = [];

  for (const target of targets) {
    const loaded = await loadDefinitions(target);
    definitions.push(...loaded);
  }

  if (definitions.length === 0) {
    console.warn('No template definitions found in', targets.join(', '));
    return;
  }

  for (const def of definitions) {
    try {
      log.info({ templateId: def.templateId, version: def.version, dryRun }, 'registry.publishTemplates.cli.start');
      if (dryRun) {
        log.info({ templateId: def.templateId, version: def.version }, 'registry.publishTemplates.cli.dryRun');
        continue;
      }
      const result = await publishTemplate(def);
      log.info({ templateId: result.templateId, version: result.currentVersion }, 'registry.publishTemplates.cli.success');
    } catch (err) {
      log.error({ templateId: def.templateId, version: def.version, err }, 'registry.publishTemplates.cli.failure');
      process.exitCode = 1;
    }
  }
}

main().catch(err => {
  log.error({ err }, 'registry.publishTemplates.cli.fatal');
  process.exit(1);
});
