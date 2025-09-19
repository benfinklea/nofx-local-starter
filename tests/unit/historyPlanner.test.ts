import { HistoryPlanner } from '../../src/services/responses/historyPlanner';

describe('HistoryPlanner', () => {
  it('prefers vendor conversations when truncation is disabled and tokens exceed threshold', () => {
    const planner = new HistoryPlanner({ contextWindowTokens: 128000 });
    const plan = planner.plan({
      estimatedTokens: 150000,
      eventCount: 200,
      truncation: 'disabled',
    });
    expect(plan.strategy).toBe('vendor');
    expect(plan.warnings[0]).toMatch(/Truncation disabled/);
  });

  it('replays history with auto truncation and trims oldest events when necessary', () => {
    const planner = new HistoryPlanner({ contextWindowTokens: 1000 });
    const plan = planner.plan({
      estimatedTokens: 2000,
      eventCount: 100,
      truncation: 'auto',
    });
    expect(plan.strategy).toBe('replay');
    expect(plan.trimmedEvents).toBeGreaterThan(0);
    expect(plan.warnings[0]).toMatch(/Trimmed/);
  });

  it('honors tenant preference to replay even when under limits', () => {
    const planner = new HistoryPlanner({ contextWindowTokens: 1000 });
    const plan = planner.plan({
      estimatedTokens: 500,
      eventCount: 20,
      truncation: 'auto',
      preference: 'prefer_replay',
    });
    expect(plan.strategy).toBe('replay');
    expect(plan.trimmedEvents).toBe(0);
  });
});
