import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { BuilderConfigStore } from '../../src/services/builder/builderStore';
import { BuilderTemplateManager } from '../../src/services/builder/builderManager';

function createManagerTmp() {
  const baseDir = path.join(os.tmpdir(), `builder-manager-${Math.random().toString(16).slice(2)}`);
  const store = new BuilderConfigStore({ baseDir });
  const manager = new BuilderTemplateManager(store);
  return { baseDir, manager };
}

describe('BuilderTemplateManager', () => {
  let baseDir: string;
  let manager: BuilderTemplateManager;

  beforeEach(async () => {
    ({ baseDir, manager } = createManagerTmp());
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('lists seeded templates on first load', async () => {
    const templates = await manager.listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t) => t.name === 'Daily Focus Coach')).toBe(true);
  });

  it('creates, updates, and toggles deployment for a template', async () => {
    const created = await manager.createTemplate({
      name: 'Energy Coach',
      description: 'Recommend breaks',
      instructions: 'Suggest two actions',
      model: 'gpt-4.1-mini',
      input: [{ id: 'energy', type: 'input_text', text: 'Energy: {{energy}}' }],
      channels: { slack: false, email: true, inApp: true },
    });
    expect(created.name).toBe('Energy Coach');

    const updated = await manager.updateTemplate(created.id, { description: 'Recommend breaks and tasks' });
    expect(updated.description).toContain('tasks');

    const deployed = await manager.updateDeployment(created.id, { environment: 'production', channel: 'slack', enabled: true });
    expect(deployed.deployments.production.slack).toBe(true);
  });

  it('returns history snapshots and compile previews', async () => {
    const template = await manager.createTemplate({
      name: 'Sync Brief',
      description: 'Prep meeting sync',
      instructions: 'Provide agenda',
      model: 'gpt-4.1-mini',
      input: [
        { id: 'agenda', type: 'input_text', text: 'Agenda: {{agenda}}' },
        { id: 'notes', type: 'input_text', text: 'Notes: {{notes}}' },
      ],
      channels: { slack: true, email: false, inApp: true },
    });

    await manager.updateTemplate(template.id, { description: 'Prep meeting sync with follow-ups' });

    const history = await manager.getHistory(template.id);
    expect(history).toHaveLength(2);

    const compiled = await manager.compileTemplate(template.id, {
      tenantId: 'tenant-xyz',
      variables: { agenda: 'Roadmap review', notes: 'Budget approvals' },
    });

    expect(compiled.metadata?.template_id).toBe(template.id);
    expect(Array.isArray(compiled.request.input)).toBe(true);
  });

  it('throws when compiling missing template', async () => {
    await expect(
      manager.compileTemplate('missing', { tenantId: 't', variables: { foo: 'bar' } }),
    ).rejects.toThrow('template not found');
  });
});
