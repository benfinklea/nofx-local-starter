import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateTemplate } from '../../src/lib/registry';
import { log } from '../../src/lib/observability';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';

const DEFAULT_TEMPLATE_DIRS = [
  path.join(process.cwd(), 'packages', 'shared', 'templates'),
  path.join(process.cwd(), 'registry', 'templates')
];

function resolveDefaultTarget(): string {
  for (const candidate of DEFAULT_TEMPLATE_DIRS) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Always return the first directory as fallback, guaranteed to be defined
  return DEFAULT_TEMPLATE_DIRS[0] as string;
}

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
          // skip directories without a manifest
        }
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      const full = path.join(targetPath, entry.name);
      const data = JSON.parse(await fs.readFile(full, 'utf8'));
      definitions.push(data as PublishTemplateRequest);
    }
    return definitions;
  }

  const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
  return Array.isArray(data) ? data : [data];
}

async function main() {
  // @ts-ignore - process.argv[2] may be undefined, handled by resolveDefaultTarget
  const target: string = process.argv[2] || resolveDefaultTarget();
  const definitions = await loadDefinitions(target);
  if (definitions.length === 0) {
    log.warn({ target }, 'registry.validateTemplates.cli.none');
    return;
  }

  let failures = 0;

  for (const def of definitions) {
    const result = await validateTemplate(def);
    if (result.valid) {
      log.info({ templateId: def.templateId }, 'registry.validateTemplates.cli.valid');
    } else {
      failures += 1;
      log.error({ templateId: def.templateId, errors: result.errors }, 'registry.validateTemplates.cli.invalid');
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  log.error({ err }, 'registry.validateTemplates.cli.fatal');
  process.exit(1);
});
