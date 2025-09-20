import type { BuilderTemplate } from './builderTypes';
import { BuilderConfigStore } from './builderStore';

const DEFAULT_SEEDS = [
  {
    name: 'Daily Focus Coach',
    description: 'Summarise priorities and propose the next best actions with energy-aware guidance.',
    instructions:
      'You are the Daily Focus Coach. Produce three prioritized tasks with rationale, callouts for blockers, and a suggested check-in cadence. Always include a short encouragement line.',
    model: 'gpt-4.1-mini',
    input: [
      { id: 'context', type: 'input_text', text: 'Context: {{context}}' },
      { id: 'events', type: 'input_text', text: 'Upcoming events: {{events}}' },
      { id: 'energy', type: 'input_text', text: 'Energy level: {{energy}}' },
    ],
    metadata: { template_seed: 'daily-focus' },
    channels: { slack: true, email: true, inApp: true },
  },
  {
    name: 'Meeting Prep Companion',
    description: 'Distill agenda, attendees, goals, and propose prep checklist.',
    instructions:
      'Craft a preparation brief with agenda summary, talking points per attendee, open questions, and a pre-meeting checklist. Provide bullet formatting ready for quick review.',
    model: 'gpt-4.1-mini',
    input: [
      { id: 'meeting', type: 'input_text', text: 'Meeting details: {{meeting}}' },
      { id: 'prior_notes', type: 'input_text', text: 'Prior notes: {{notes}}' },
    ],
    metadata: { template_seed: 'meeting-prep' },
    channels: { slack: false, email: true, inApp: true },
  },
  {
    name: 'Campaign Tracker Digest',
    description: 'Summarise marketing campaign metrics and surface anomalies.',
    instructions:
      'Produce a digest with performance snapshot, anomalies detected, recommended next actions, and risk flags. Highlight metrics outside threshold.',
    model: 'gpt-4.1-mini',
    input: [
      { id: 'campaign', type: 'input_text', text: 'Campaign summary: {{campaign}}' },
      { id: 'metrics', type: 'input_text', text: 'Metric snapshot: {{metrics}}' },
      { id: 'thresholds', type: 'input_text', text: 'Thresholds: {{thresholds}}' },
    ],
    metadata: { template_seed: 'campaign-tracker' },
    channels: { slack: true, email: true, inApp: false },
  },
] as const;

export async function applyTemplateSeeds({ tenantId, store }: { tenantId: string; store: BuilderConfigStore }) {
  const added: BuilderTemplate[] = [];
  const skipped: string[] = [];

  const existing = await store.list();
  const existingNames = new Set(existing.map((tpl) => tpl.name.toLowerCase()));

  for (const seed of DEFAULT_SEEDS) {
    if (existingNames.has(seed.name.toLowerCase())) {
      skipped.push(seed.name);
      continue;
    }
    const enriched = {
      ...seed,
      input: seed.input.map((part) => ({ ...part })),
      channels: { ...seed.channels },
      metadata: {
        ...(seed.metadata ?? {}),
        tenant: tenantId,
      },
    };
    const saved = await store.save(enriched);
    added.push(saved);
  }

  return { added, skipped };
}
