import { describe, expect, it } from '@jest/globals';
import type { BuilderTemplate } from '../../src/services/builder/builderTypes';
import { compileTemplateToRunConfig } from '../../src/services/builder/builderCompiler';

const template: BuilderTemplate = {
  id: 'tmpl_test',
  name: 'Daily Focus Coach',
  description: 'Help operators pick next best task',
  instructions: 'Provide three prioritized tasks with supporting rationale.',
  model: 'gpt-4.1-mini',
  input: [
    { id: 'context', type: 'input_text', text: 'Context: {{context}}' },
    { id: 'goals', type: 'input_text', text: 'Goals: {{goals}}' },
  ],
  metadata: { template: 'daily-focus' },
  channels: { slack: true, email: true, inApp: true },
  safetyIdentifier: 'focus-template',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deployments: {
    development: { slack: false, email: false, inApp: true },
    staging: { slack: false, email: true, inApp: true },
    production: { slack: true, email: true, inApp: true },
  },
  history: [],
};

describe('compileTemplateToRunConfig', () => {
  it('produces a ResponsesRunConfig with merged metadata and placeholders', () => {
    const runConfig = compileTemplateToRunConfig({
      template,
      tenantId: 'tenant-123',
      variables: {
        context: 'Client QBR and outstanding tasks',
        goals: 'Prepare QBR deck, align stakeholders',
      },
    });

    expect(runConfig.request.metadata?.template).toBe('daily-focus');
    expect(Array.isArray(runConfig.request.input)).toBe(true);
    const firstMessage = Array.isArray(runConfig.request.input) ? runConfig.request.input[0] : undefined;
    expect(firstMessage?.content).toHaveLength(2);
    expect(firstMessage?.content?.[0]).toMatchObject({ type: 'input_text' });
    expect(runConfig.request.safety_identifier).toBe('focus-template');
    expect(runConfig.metadata?.template_id).toBe('tmpl_test');
  });

  it('throws when required variables are missing', () => {
    expect(() =>
      compileTemplateToRunConfig({
        template,
        tenantId: 'tenant-123',
        variables: { context: 'Only context' },
      }),
    ).toThrow('Missing variable goals');
  });
});
