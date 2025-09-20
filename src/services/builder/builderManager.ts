import { z } from 'zod';
import { BuilderConfigStore } from './builderStore';
import { applyTemplateSeeds } from './templateCatalog';
import type {
  BuilderTemplate,
  BuilderTemplateInput,
  BuilderEnvironment,
  BuilderChannel,
} from './builderTypes';
import { compileTemplateToRunConfig } from './builderCompiler';

const variableSchema = z.record(z.string(), z.string());

export class BuilderTemplateManager {
  private readonly store: BuilderConfigStore;

  private seeded = false;

  constructor(store = new BuilderConfigStore()) {
    this.store = store;
  }

  private async ensureSeeds() {
    const templates = await this.store.list().catch(() => [] as BuilderTemplate[]);
    if (!templates.length) {
      await applyTemplateSeeds({ tenantId: 'default', store: this.store });
      this.seeded = true;
      return;
    }
    if (!this.seeded) {
      this.seeded = true;
    }
  }

  async listTemplates(): Promise<BuilderTemplate[]> {
    await this.ensureSeeds();
    return this.store.list();
  }

  async createTemplate(input: BuilderTemplateInput): Promise<BuilderTemplate> {
    await this.ensureSeeds();
    return this.store.save(input);
  }

  async updateTemplate(id: string, patch: Partial<BuilderTemplateInput>): Promise<BuilderTemplate> {
    await this.ensureSeeds();
    const existing = await this.store.get(id);
    if (!existing) throw new Error('template not found');
    const nextInput: BuilderTemplateInput = {
      ...existing,
      ...patch,
      id: existing.id,
      input: patch.input ? patch.input.map((part) => ({ ...part })) : existing.input.map((part) => ({ ...part })),
      channels: patch.channels ? { ...patch.channels } : existing.channels,
    };
    return this.store.save(nextInput);
  }

  async updateDeployment(id: string, opts: { environment: BuilderEnvironment; channel: BuilderChannel; enabled: boolean }) {
    await this.ensureSeeds();
    return this.store.updateDeployment(id, opts);
  }

  async getHistory(id: string) {
    await this.ensureSeeds();
    return this.store.history(id);
  }

  async compileTemplate(id: string, options: { tenantId: string; variables: Record<string, string>; metadata?: Record<string, string> }) {
    await this.ensureSeeds();
    const template = await this.store.get(id);
    if (!template) throw new Error('template not found');
    const parsedVariables = variableSchema.parse(options.variables);
    return compileTemplateToRunConfig({ template, tenantId: options.tenantId, variables: parsedVariables, metadata: options.metadata });
  }
}
