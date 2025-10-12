import { buildPlanFromPrompt, guessMarkdownPath } from '../../src/api/planBuilder';

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: true, lint: true, unit: true, coverageThreshold: 0.9 },
    llm: { order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] }, modelOrder: { docs: [], reasoning: [], codegen: [] } }
  }))
}));

jest.mock('../../src/lib/registry', () => ({
  listAgents: jest.fn(async () => ({
    agents: [
      {
        id: 'agent-row-id',
        agentId: 'builder-default-agent',
        name: 'Builder Default Agent',
        description: 'Default helper agent',
        status: 'active',
        currentVersion: '1.0.0',
        capabilities: [],
        tags: ['default'],
        updatedAt: new Date().toISOString()
      }
    ]
  })),
  listTemplates: jest.fn(async () => ({
    templates: [
      {
        id: 'template-row-id',
        templateId: 'readme-template',
        name: 'README Template',
        description: 'Starter README copy',
        status: 'published',
        currentVersion: '1.0.0',
        tags: ['docs'],
        category: 'documentation',
        popularityScore: 10,
        updatedAt: new Date().toISOString()
      }
    ]
  }))
}));

describe('planBuilder', () => {
  test('includes gates from settings when quality true', async () => {
    const plan = await buildPlanFromPrompt('Write README', { quality: true, openPr: false });
    const tools = plan.steps.map(s=>s.tool);
    expect(tools[0]).toBe('codegen');
    expect(tools.slice(1,4)).toEqual(['gate:typecheck','gate:lint','gate:unit']);
    expect(plan.metadata).toMatchObject({
      suggestedAgentId: 'builder-default-agent',
      suggestedTemplateId: 'readme-template'
    });
    const writeStep = plan.steps.find(step => step.tool === 'codegen');
    expect(writeStep?.inputs?.agentOptions).toBeDefined();
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

  test('guessMarkdownPath infers filename from content-type keywords', () => {
    // Haiku and poetry
    expect(guessMarkdownPath('write a haiku')).toBe('haiku.md');
    expect(guessMarkdownPath('Write a haiku about cats')).toBe('haiku.md');
    expect(guessMarkdownPath('create a poem')).toBe('poem.md');
    expect(guessMarkdownPath('Write poetry about the ocean')).toBe('poem.md');

    // Other content types
    expect(guessMarkdownPath('write a story about adventure')).toBe('story.md');
    expect(guessMarkdownPath('create a recipe for cookies')).toBe('recipe.md');
    expect(guessMarkdownPath('write a tutorial on testing')).toBe('tutorial.md');
    expect(guessMarkdownPath('generate a report')).toBe('report.md');
    expect(guessMarkdownPath('create notes for meeting')).toBe('notes.md');

    // Should not match partial words
    expect(guessMarkdownPath('repair the authentication')).toBeUndefined();
    expect(guessMarkdownPath('reporting service')).toBeUndefined(); // 'reporting' != 'report'
    expect(guessMarkdownPath('generate a report')).toBe('report.md'); // 'report' is whole word

    // Explicit .md path takes priority over keyword
    expect(guessMarkdownPath('write a haiku in custom.md')).toBe('custom.md');
  });
});
