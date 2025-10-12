import { query } from './db';

export type ApprovalsSettings = {
  dbWrites: 'none'|'dangerous'|'all';
  allowWaive: boolean;
};

export type GateSeverity = 'info' | 'warning' | 'error' | 'critical';

export type GateConfig = {
  enabled: boolean;
  severity: GateSeverity;
};

export type GatesSettings = {
  typecheck: boolean | GateConfig;
  lint: boolean | GateConfig;
  unit: boolean | GateConfig;
  coverageThreshold: number; // 0..1
  sast?: boolean | GateConfig;
  audit?: boolean | GateConfig;
  secrets?: boolean | GateConfig;
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
  traceLoggingEnabled?: boolean;
};

type SettingsRow = {
  approvals: Partial<ApprovalsSettings> | null;
  gates: Record<string, unknown> | null;
  llm: Partial<LlmSettings> & {
    order?: Partial<LlmSettings['order']>;
    modelOrder?: Partial<LlmSettings['modelOrder']>;
    pricing?: Record<string, PricingOverride>;
  } | null;
  ops: Partial<OpsSettings> | null;
};

type PricingOverride = {
  inputPer1M?: number;
  outputPer1M?: number;
  inputPer1K?: number;
  outputPer1K?: number;
};

const DEFAULTS: Settings = {
  approvals: { dbWrites: 'dangerous', allowWaive: true },
  gates: {
    typecheck: { enabled: true, severity: 'warning' },
    lint: { enabled: true, severity: 'warning' },
    unit: { enabled: true, severity: 'error' },
    coverageThreshold: 0.9,
    sast: { enabled: true, severity: 'error' },
    audit: { enabled: true, severity: 'warning' },
    secrets: { enabled: true, severity: 'critical' }
  },
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
  ops: { backupIntervalMin: 0, traceLoggingEnabled: false }
};

// Helper to normalize gate config from boolean or object format
function normalizeGateConfig(value: boolean | GateConfig | undefined, defaultSeverity: GateSeverity): GateConfig {
  if (typeof value === 'boolean') {
    return { enabled: value, severity: defaultSeverity };
  }
  if (value && typeof value === 'object' && 'enabled' in value) {
    return { enabled: value.enabled, severity: value.severity || defaultSeverity };
  }
  return { enabled: true, severity: defaultSeverity };
}

// Helper to check if gate should block the run based on severity
export function shouldGateBlock(severity: GateSeverity): boolean {
  return severity === 'critical';
}

async function ensureSettingsSchema() {
  try {
    await query(`alter table nofx.settings add column if not exists llm jsonb not null default '{}'::jsonb`);
  } catch {}
  try {
    await query(`alter table nofx.settings add column if not exists ops jsonb not null default '{}'::jsonb`);
  } catch {}
}

export async function getSettings(): Promise<Settings> {
  try {
    await ensureSettingsSchema();
    const r = await query<SettingsRow>(`select approvals, gates, llm, ops from nofx.settings where id='default' limit 1`);
    const row = r.rows[0];
    if (!row) return DEFAULTS;
    const approvals = { ...DEFAULTS.approvals, ...(row.approvals || {}) };

    // Normalize gate configs to support both old boolean and new object format
    const rawGates = row.gates || {};
    const gates: GatesSettings = {
      typecheck: normalizeGateConfig(rawGates.typecheck as boolean | GateConfig | undefined, 'warning'),
      lint: normalizeGateConfig(rawGates.lint as boolean | GateConfig | undefined, 'warning'),
      unit: normalizeGateConfig(rawGates.unit as boolean | GateConfig | undefined, 'error'),
      coverageThreshold: (rawGates.coverageThreshold as number | undefined) ?? DEFAULTS.gates.coverageThreshold,
      sast: normalizeGateConfig(rawGates.sast as boolean | GateConfig | undefined, 'error'),
      audit: normalizeGateConfig(rawGates.audit as boolean | GateConfig | undefined, 'warning'),
      secrets: normalizeGateConfig(rawGates.secrets as boolean | GateConfig | undefined, 'critical')
    };

    const rawLlm = row.llm || {};
    const llm: LlmSettings = {
      order: {
        codegen: rawLlm.order?.codegen || DEFAULTS.llm.order.codegen,
        reasoning: rawLlm.order?.reasoning || DEFAULTS.llm.order.reasoning,
        docs: rawLlm.order?.docs || DEFAULTS.llm.order.docs
      },
      modelOrder: {
        docs: rawLlm.modelOrder?.docs || [],
        reasoning: rawLlm.modelOrder?.reasoning || [],
        codegen: rawLlm.modelOrder?.codegen || []
      },
      providers: rawLlm.providers || {},
      pricing: normalizePricing(rawLlm.pricing || {})
    };
    const rawOps = row.ops || {};
    const ops: OpsSettings = {
      backupIntervalMin: rawOps.backupIntervalMin ?? DEFAULTS.ops?.backupIntervalMin,
      traceLoggingEnabled: rawOps.traceLoggingEnabled ?? DEFAULTS.ops?.traceLoggingEnabled
    };
    return { approvals, gates, llm, ops };
  } catch {
    return DEFAULTS; // schema may not be migrated yet; fail-safe defaults
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const llmPatch = patch.llm;
  const opsPatch = patch.ops;
  const next: Settings = {
    approvals: { ...current.approvals, ...(patch.approvals || {}) },
    gates: { ...current.gates, ...(patch.gates || {}) },
    llm: {
      order: {
        codegen: llmPatch?.order?.codegen || current.llm.order.codegen,
        reasoning: llmPatch?.order?.reasoning || current.llm.order.reasoning,
        docs: llmPatch?.order?.docs || current.llm.order.docs,
      },
      modelOrder: {
        docs: llmPatch?.modelOrder?.docs || current.llm.modelOrder?.docs || [],
        reasoning: llmPatch?.modelOrder?.reasoning || current.llm.modelOrder?.reasoning || [],
        codegen: llmPatch?.modelOrder?.codegen || current.llm.modelOrder?.codegen || []
      },
      providers: llmPatch?.providers || current.llm.providers || {},
      pricing: normalizePricing(llmPatch?.pricing || current.llm.pricing || {})
    },
    ops: {
      backupIntervalMin: opsPatch?.backupIntervalMin ?? current.ops?.backupIntervalMin ?? DEFAULTS.ops?.backupIntervalMin,
      traceLoggingEnabled: opsPatch?.traceLoggingEnabled ?? current.ops?.traceLoggingEnabled ?? DEFAULTS.ops?.traceLoggingEnabled
    }
  };
  try {
    await ensureSettingsSchema();
    await query(
      `insert into nofx.settings (id, approvals, gates, llm, ops)
       values ('default', $1, $2, $3, $4)
       on conflict(id) do update set approvals=excluded.approvals, gates=excluded.gates, llm=excluded.llm, ops=excluded.ops, updated_at=now()`,
      [next.approvals, next.gates, next.llm, next.ops]
    );
  } catch {
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

function normalizePricing(input: Record<string, PricingOverride>): LlmSettings['pricing'] {
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
      out[provider] = { inputPer1M: inPer1M, outputPer1M: outPer1M };
    }
  }
  return out;
}
