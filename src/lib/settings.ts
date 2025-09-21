import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';

export type ApprovalsSettings = {
  dbWrites: 'none'|'dangerous'|'all';
  allowWaive: boolean;
};
export type GatesSettings = {
  typecheck: boolean;
  lint: boolean;
  unit: boolean;
  coverageThreshold: number; // 0..1
  sast?: boolean;
  audit?: boolean;
  secrets?: boolean;
};
export type Settings = {
  approvals: ApprovalsSettings;
  gates: GatesSettings;
  llm: LlmSettings;
  ops?: OpsSettings;
};

export type LlmSettings = {
  order: {
    codegen: Array<'openai'|'anthropic'|'gemini'>;
    reasoning: Array<'openai'|'anthropic'|'gemini'>;
    docs: Array<'openai'|'anthropic'|'gemini'>;
  };
  modelOrder?: { docs?: string[]; reasoning?: string[]; codegen?: string[] };
  providers?: Record<string, { kind: 'openai-compatible'|'http'; baseUrl?: string }>;
  pricing?: Record<string, { inputPer1M?: number; outputPer1M?: number }>;
};

export type OpsSettings = {
  backupIntervalMin?: number; // 0 disables periodic backups
};

const DEFAULTS: Settings = {
  approvals: { dbWrites: 'dangerous', allowWaive: true },
  gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9, sast: true, audit: true, secrets: true },
  llm: {
    order: {
      codegen: ['openai','anthropic','gemini'],
      reasoning: ['anthropic','openai','gemini'],
      docs: ['gemini','anthropic','openai']
    },
    modelOrder: { docs: [], reasoning: [], codegen: [] },
    providers: {},
    pricing: {}
  },
  ops: { backupIntervalMin: 0 }
};

const ROOT = path.join(process.cwd(), 'local_data');
const FILE = path.join(ROOT, 'settings.json');

function ensureDirSync(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function usingFsStore(): boolean {
  const queueDriver = (process.env.QUEUE_DRIVER || 'memory').toLowerCase();
  const driver = (process.env.DATA_DRIVER || (queueDriver === 'memory' ? 'fs' : 'db')).toLowerCase();
  return driver === 'fs';
}

async function readFsSettings(): Promise<Settings> {
  ensureDirSync(ROOT);
  try {
    const raw = await fsp.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return mergeSettings(DEFAULTS, parsed);
  } catch {
    return DEFAULTS;
  }
}

async function writeFsSettings(settings: Settings): Promise<void> {
  ensureDirSync(ROOT);
  await fsp.writeFile(FILE, JSON.stringify(settings, null, 2));
}

async function ensureSettingsSchema() {
  if (usingFsStore()) return;
  try {
    await query(`alter table nofx.settings add column if not exists llm jsonb not null default '{}'::jsonb`);
  } catch {}
  try {
    await query(`alter table nofx.settings add column if not exists ops jsonb not null default '{}'::jsonb`);
  } catch {}
}

export async function getSettings(): Promise<Settings> {
  if (usingFsStore()) {
    return readFsSettings();
  }
  try {
    await ensureSettingsSchema();
    const r = await query<{ approvals: any; gates: any; llm: any; ops: any }>(`select approvals, gates, llm, ops from nofx.settings where id='default' limit 1`);
    if (!r.rows[0]) return DEFAULTS;
    const approvals = { ...DEFAULTS.approvals, ...(r.rows[0].approvals || {}) };
    const gates = { ...DEFAULTS.gates, ...(r.rows[0].gates || {}) };
    const llm: LlmSettings = {
      order: {
        codegen: (r.rows[0].llm?.order?.codegen || DEFAULTS.llm.order.codegen),
        reasoning: (r.rows[0].llm?.order?.reasoning || DEFAULTS.llm.order.reasoning),
        docs: (r.rows[0].llm?.order?.docs || DEFAULTS.llm.order.docs)
      },
      modelOrder: {
        docs: r.rows[0].llm?.modelOrder?.docs || [],
        reasoning: r.rows[0].llm?.modelOrder?.reasoning || [],
        codegen: r.rows[0].llm?.modelOrder?.codegen || []
      },
      providers: r.rows[0].llm?.providers || {},
      pricing: r.rows[0].llm?.pricing || {}
    };
    const ops: OpsSettings = {
      backupIntervalMin: r.rows[0].ops?.backupIntervalMin ?? DEFAULTS.ops?.backupIntervalMin
    };
    return { approvals, gates, llm, ops };
  } catch {
    return DEFAULTS; // schema may not be migrated yet; fail-safe defaults
  }
}

function mergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  const current = base;
  return {
    approvals: { ...current.approvals, ...(patch.approvals || {}) },
    gates: { ...current.gates, ...(patch.gates || {}) },
    llm: {
      order: {
        codegen: (patch as any).llm?.order?.codegen || current.llm.order.codegen,
        reasoning: (patch as any).llm?.order?.reasoning || current.llm.order.reasoning,
        docs: (patch as any).llm?.order?.docs || current.llm.order.docs,
      },
      modelOrder: {
        docs: (patch as any).llm?.modelOrder?.docs || current.llm.modelOrder?.docs || [],
        reasoning: (patch as any).llm?.modelOrder?.reasoning || current.llm.modelOrder?.reasoning || [],
        codegen: (patch as any).llm?.modelOrder?.codegen || current.llm.modelOrder?.codegen || []
      },
      providers: (patch as any).llm?.providers || current.llm.providers || {},
      pricing: normalizePricing((patch as any).llm?.pricing || current.llm.pricing || {})
    },
    ops: {
      backupIntervalMin: (patch as any).ops?.backupIntervalMin ?? current.ops?.backupIntervalMin ?? DEFAULTS.ops?.backupIntervalMin
    }
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  if (usingFsStore()) {
    const current = await readFsSettings();
    const next = mergeSettings(current, patch);
    await writeFsSettings(next);
    return next;
  }
  const current = await getSettings();
  const next = mergeSettings(current, patch);
  try {
    await ensureSettingsSchema();
    await query(
      `insert into nofx.settings (id, approvals, gates, llm, ops)
       values ('default', $1, $2, $3, $4)
       on conflict(id) do update set approvals=excluded.approvals, gates=excluded.gates, llm=excluded.llm, ops=excluded.ops, updated_at=now()`,
      [next.approvals, next.gates, next.llm, next.ops]
    );
  } catch (e) {
    // fallback for older schema without llm
    await query(
      `insert into nofx.settings (id, approvals, gates)
       values ('default', $1, $2)
       on conflict(id) do update set approvals=excluded.approvals, gates=excluded.gates, updated_at=now()`,
      [next.approvals, next.gates]
    );
  }
  return next;
}

function normalizePricing(input: any): LlmSettings['pricing'] {
  const out: LlmSettings['pricing'] = {};
  const keys = input ? Object.keys(input) : [];
  for (const provider of keys) {
    const p = input?.[provider] || {};
    let inPer1M = p.inputPer1M;
    let outPer1M = p.outputPer1M;
    // Backward-compat: convert per 1K to per 1M if present
    if ((inPer1M == null) && p.inputPer1K != null) inPer1M = Number(p.inputPer1K) * 1000;
    if ((outPer1M == null) && p.outputPer1K != null) outPer1M = Number(p.outputPer1K) * 1000;
    if (inPer1M != null || outPer1M != null) {
      (out as any)[provider] = { inputPer1M: inPer1M, outputPer1M: outPer1M };
    }
  }
  return out;
}
