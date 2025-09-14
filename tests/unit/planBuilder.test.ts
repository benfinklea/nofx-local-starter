import { buildPlanFromPrompt, guessMarkdownPath } from '../../src/api/planBuilder';

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9 },
    llm: { order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] }, modelOrder: { docs: [], reasoning: [], codegen: [] } }
  }))
}));

describe('planBuilder', () => {
  test('includes gates from settings when quality true', async () => {
    const plan = await buildPlanFromPrompt('Write README', { quality: true, openPr: false });
    const tools = plan.steps.map(s=>s.tool);
    expect(tools.slice(0,3)).toEqual(['gate:typecheck','gate:lint','gate:unit']);
    expect(tools).toContain('codegen');
  });

  test('adds PR because of prompt even when toggle off, labeled Prompt', async () => {
    const plan = await buildPlanFromPrompt('Write README and open a PR', { quality: false, openPr: false });
    const pr = plan.steps.find(s=>s.tool==='git_pr');
    expect(pr).toBeTruthy();
    expect(pr?.inputs?.reason).toBe('Prompt');
  });

  test('adds PR because of setting when toggle on, labeled Setting', async () => {
    const plan = await buildPlanFromPrompt('Write README', { quality: false, openPr: true });
    const pr = plan.steps.find(s=>s.tool==='git_pr');
    expect(pr).toBeTruthy();
    expect(pr?.inputs?.reason).toBe('Setting');
  });

  test('adds summarize step and optional PR for summary target', async () => {
    const plan = await buildPlanFromPrompt('Summarize findings', { quality: false, openPr: true, summarizeQuery: 'pricing', summarizeTarget: 'docs/summary.md' });
    const sum = plan.steps.find(s=>s.name==='summarize' && s.tool==='codegen');
    expect(sum).toBeTruthy();
    const pr = plan.steps.find(s=>s.name.includes('summary') && s.tool==='git_pr');
    expect(pr).toBeTruthy();
  });

  test('guessMarkdownPath detects inline path and docs hint', () => {
    expect(guessMarkdownPath('Create docs/overview.md please')).toBe('docs/overview.md');
    expect(guessMarkdownPath('Put it in docs')).toBe('docs/README.md');
    expect(guessMarkdownPath('No path here')).toBeUndefined();
  });
});

