import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { BuilderTemplateInput } from '../../src/services/builder/builderTypes';
import { BuilderConfigStore } from '../../src/services/builder/builderStore';
import { applyTemplateSeeds } from '../../src/services/builder/templateCatalog';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-store-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('BuilderConfigStore', () => {
  it('persists templates and returns canonical shape', async () => {
    const store = new BuilderConfigStore({ baseDir: tmpDir });
    const input: BuilderTemplateInput = {
      name: 'Daily Focus Coach',
      description: 'Suggest next best tasks',
      instructions: 'Provide focus plan',
      model: 'gpt-4.1-mini',
      input: [{ id: 'focus', type: 'input_text', text: 'Summarize the key focus areas' }],
      metadata: { team: 'ops' },
      channels: { slack: true, email: false, inApp: true },
    };

    const saved = await store.save(input);
    expect(saved.id).toMatch(/^tmpl_/);
    expect(saved.safetyIdentifier).toMatch(/^focus-/);
    expect(saved.createdAt).toBeDefined();

    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Daily Focus Coach');

    const fetched = await store.get(saved.id);
    expect(fetched?.channels.slack).toBe(true);
    expect(fetched?.channels.email).toBe(false);
  });

  it('updates templates in-place and bumps updatedAt', async () => {
    const store = new BuilderConfigStore({ baseDir: tmpDir });
    const initial = await store.save({
      name: 'Meeting Prep',
      description: 'Prepare agendas',
      instructions: 'Draft preparation outline',
      model: 'gpt-4.1-mini',
      input: [{ id: 'agenda', type: 'input_text', text: 'Assemble agenda' }],
      channels: { slack: false, email: true, inApp: true },
    });
    const firstUpdatedAt = initial.updatedAt;

    const updated = await store.save({
      ...initial,
      description: 'Prepare meeting agendas and follow-ups',
      channels: { slack: true, email: true, inApp: true },
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.description).toContain('follow-ups');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(firstUpdatedAt).getTime());
  });

  it('applies template seeds without duplicating existing templates', async () => {
    const store = new BuilderConfigStore({ baseDir: tmpDir });
    await store.save({
      name: 'Daily Focus Coach',
      description: 'custom override',
      instructions: 'Custom instructions',
      model: 'gpt-4.1-mini',
      input: [{ id: 'focus', type: 'input_text', text: 'Focus tasks' }],
      channels: { slack: true, email: true, inApp: true },
    });

    const seeds = await applyTemplateSeeds({ tenantId: 'tenant-seed', store });
    const templates = await store.list();

    const names = templates.map((t) => t.name);
    expect(names.filter((n) => n === 'Daily Focus Coach')).toHaveLength(1);
    expect(templates.length).toBeGreaterThan(1);
    expect(seeds.added.length).toBeGreaterThan(0);
  });

  it('keeps history snapshots for rollback', async () => {
    const store = new BuilderConfigStore({ baseDir: tmpDir });
    const template = await store.save({
      name: 'Campaign Tracker',
      description: 'Monitor campaign metrics',
      instructions: 'Track metrics',
      model: 'gpt-4.1-mini',
      input: [{ id: 'campaign', type: 'input_text', text: 'Campaign details' }],
      channels: { slack: true, email: true, inApp: false },
    });

    await store.save({
      ...template,
      description: 'Monitor campaign metrics and summarise',
    });

    const history = await store.history(template.id);
    expect(history).toHaveLength(2);
    expect(history[0].description).toContain('Monitor campaign metrics');
  });

  it('stores deployment toggles per environment', async () => {
    const store = new BuilderConfigStore({ baseDir: tmpDir });
    const template = await store.save({
      name: 'Energy Check',
      description: 'Recommend breaks',
      instructions: 'Consider wearable data',
      model: 'gpt-4.1-mini',
      input: [{ id: 'energy', type: 'input_text', text: 'Describe energy levels' }],
      channels: { slack: false, email: true, inApp: true },
    });

    const toggled = await store.updateDeployment(template.id, {
      channel: 'slack',
      enabled: true,
      environment: 'production',
    });

    expect(toggled.deployments.production.slack).toBe(true);
    expect(toggled.deployments.production.email).toBe(true);
  });
});
