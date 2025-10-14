import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type BuilderTemplate,
  type BuilderTemplateInput,
  type BuilderTemplateHistoryEntry,
  type BuilderDeploymentState,
  type BuilderEnvironment,
  type DeploymentToggleInput,
} from './builderTypes';

const DEFAULT_BASE_DIR = path.join(process.cwd(), 'local_data', 'builder');
const TEMPLATE_FILE = 'templates.json';
const HISTORY_LIMIT = 20;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function defaultDeploymentState(state?: BuilderDeploymentState): BuilderDeploymentState {
  return {
    slack: state?.slack ?? false,
    email: state?.email ?? false,
    inApp: state?.inApp ?? true,
  };
}

function cloneTemplate(template: BuilderTemplate): BuilderTemplate {
  return JSON.parse(JSON.stringify(template));
}

export interface BuilderConfigStoreOptions {
  baseDir?: string;
}

export class BuilderConfigStore {
  private readonly baseDir: string;

  private readonly filePath: string;

  constructor(options: BuilderConfigStoreOptions = {}) {
    const envDir = process.env.BUILDER_STORE_DIR;
    this.baseDir = options.baseDir ?? envDir ?? DEFAULT_BASE_DIR;
    this.filePath = path.join(this.baseDir, TEMPLATE_FILE);
  }

  async list(): Promise<BuilderTemplate[]> {
    const templates = await this.loadTemplates();
    return templates.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map(cloneTemplate);
  }

  async get(id: string): Promise<BuilderTemplate | undefined> {
    const templates = await this.loadTemplates();
    const found = templates.find((t) => t.id === id);
    return found ? cloneTemplate(found) : undefined;
  }

  async save(input: BuilderTemplateInput): Promise<BuilderTemplate> {
    const templates = await this.loadTemplates();
    const nowIso = new Date().toISOString();
    const existingIndex = input.id ? templates.findIndex((t) => t.id === input.id) : -1;
    let record: BuilderTemplate;

    if (existingIndex >= 0) {
      const existing = templates[existingIndex];
      if (!existing) {
        throw new Error('Template not found at index');
      }
      const normalized = this.normalizeTemplate(input, existing.id, existing.createdAt);
      const updatedAt = this.nextUpdatedAt(existing.updatedAt);
      const merged: BuilderTemplate = {
        ...existing,
        ...normalized,
        updatedAt,
      };
      const previousSnapshot = this.createHistoryEntry(existing);
      const currentSnapshot = this.createHistoryEntry(merged, previousSnapshot.version + 1, updatedAt);
      const nextHistory = [previousSnapshot, currentSnapshot, ...existing.history].slice(0, HISTORY_LIMIT);
      record = {
        ...merged,
        history: nextHistory,
      };
      templates[existingIndex] = record;
    } else {
      const id = input.id && input.id.startsWith('tmpl_') ? input.id : `tmpl_${randomUUID()}`;
      record = {
        ...this.normalizeTemplate(input, id, nowIso),
        createdAt: input.createdAt ?? nowIso,
        updatedAt: nowIso,
        history: [],
      };
      templates.push(record);
    }

    await this.persistTemplates(templates);
    return cloneTemplate(record);
  }

  async history(id: string): Promise<BuilderTemplateHistoryEntry[]> {
    const template = await this.get(id);
    return template?.history ? template.history.map((entry) => ({ ...entry })) : [];
  }

  async updateDeployment(id: string, input: Omit<DeploymentToggleInput, 'templateId'>): Promise<BuilderTemplate> {
    const templates = await this.loadTemplates();
    const idx = templates.findIndex((t) => t.id === id);
    if (idx < 0) {
      throw new Error(`template ${id} not found`);
    }

    const template = templates[idx];
    if (!template) {
      throw new Error(`template ${id} not found at index`);
    }
    const deployments = { ...template.deployments };
    const envState = deployments[input.environment] ?? defaultDeploymentState(template.channels);
    deployments[input.environment] = { ...envState, [input.channel]: input.enabled } as BuilderDeploymentState;

    const updated: BuilderTemplate = {
      ...template,
      deployments,
      updatedAt: new Date().toISOString(),
    };
    templates[idx] = updated;
    await this.persistTemplates(templates);
    return cloneTemplate(updated);
  }

  private async ensureBaseDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private async loadTemplates(): Promise<BuilderTemplate[]> {
    await this.ensureBaseDir();
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as BuilderTemplate[];
      return parsed.map((tpl) => this.hydrateTemplate(tpl));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async persistTemplates(templates: BuilderTemplate[]) {
    await this.ensureBaseDir();
    await fs.writeFile(this.filePath, JSON.stringify(templates, null, 2));
  }

  private hydrateTemplate(template: BuilderTemplate): BuilderTemplate {
    return {
      ...template,
      channels: defaultDeploymentState(template.channels),
      deployments: this.normalizeDeployments(template.deployments ?? {}, template.channels),
      history: template.history ?? [],
    };
  }

  private normalizeTemplate(input: BuilderTemplateInput, id: string, createdAt: string): BuilderTemplate {
    const name = input.name?.trim();
    if (!name) throw new Error('Template name is required');
    if (!input.instructions?.trim()) throw new Error('Template instructions are required');
    if (!Array.isArray(input.input) || input.input.length === 0) {
      throw new Error('Template input items are required');
    }

    const safetyIdentifier = input.safetyIdentifier ?? this.deriveSafetyIdentifier(name);
    const metadata = { ...(input.metadata ?? {}) };
    const channels = defaultDeploymentState(input.channels);
    const deployments = this.normalizeDeployments(input.deployments ?? {}, channels);

    const base: BuilderTemplate = {
      id,
      name,
      description: input.description?.trim() ?? '',
      instructions: input.instructions.trim(),
      model: input.model?.trim() || 'gpt-4.1-mini',
      input: input.input.map((item) => ({ ...item })),
      metadata,
      channels,
      tools: input.tools,
      maxToolCalls: input.maxToolCalls,
      toolChoice: input.toolChoice,
      historyPlan: input.historyPlan,
      conversationPolicy: input.conversationPolicy,
      deployments,
      safetyIdentifier,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      history: this.ensureHistory(input.history),
    };

    return base;
  }

  private nextUpdatedAt(previous: string): string {
    const prevTime = new Date(previous).getTime();
    const now = Date.now();
    const next = now <= prevTime ? prevTime + 1 : now;
    return new Date(next).toISOString();
  }

  private ensureHistory(history?: BuilderTemplateHistoryEntry[]): BuilderTemplateHistoryEntry[] {
    if (!history) return [];
    return history.map((entry, index) => ({
      version: entry.version ?? index + 1,
      description: entry.description,
      instructions: entry.instructions,
      updatedAt: entry.updatedAt,
    }));
  }

  private normalizeDeployments(
    provided: Partial<Record<BuilderEnvironment, BuilderDeploymentState>>,
    fallback: BuilderDeploymentState,
  ): Record<BuilderEnvironment, BuilderDeploymentState> {
    const base = defaultDeploymentState(fallback);
    return {
      development: defaultDeploymentState(provided.development ?? base),
      staging: defaultDeploymentState(provided.staging ?? base),
      production: defaultDeploymentState(provided.production ?? base),
    };
  }

  private deriveSafetyIdentifier(name: string): string {
    const slug = slugify(name).replace(/^-+|-+$/g, '').slice(0, 48) || 'template';
    return `focus-${slug}`;
  }

  private createHistoryEntry(
    template: BuilderTemplate,
    overrideVersion?: number,
    overrideUpdatedAt?: string,
  ): BuilderTemplateHistoryEntry {
    const nextVersion = overrideVersion ?? (template.history[0]?.version ?? template.history.length) + 1;
    return {
      version: nextVersion,
      description: template.description ?? '',
      instructions: template.instructions,
      updatedAt: overrideUpdatedAt ?? template.updatedAt,
    };
  }
}
