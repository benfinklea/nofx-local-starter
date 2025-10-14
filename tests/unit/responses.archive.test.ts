import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';

describe('InMemoryResponsesArchive', () => {
  let archive: InMemoryResponsesArchive;

  beforeEach(() => {
    archive = new InMemoryResponsesArchive();
  });

  it('stores a run and prevents duplicates', () => {
    const run = archive.startRun({ runId: 'run-1', request: canonicalTextRun });
    expect(run.status).toBe('queued');

    expect(() => archive.startRun({ runId: 'run-1', request: canonicalTextRun })).toThrow(
      "Cannot start run 'run-1': run already exists. Use updateStatus() to modify existing runs or choose a different runId.",
    );
  });

  it('records ordered events with auto-incremented sequence', () => {
    archive.startRun({ runId: 'run-2', request: canonicalTextRun });
    const first = archive.recordEvent('run-2', { type: 'response.created', payload: { id: 'resp_1' } });
    expect(first.sequence).toBe(1);
    const second = archive.recordEvent('run-2', { type: 'response.output_text.delta', payload: { delta: 'Hi' } });
    expect(second.sequence).toBe(2);

    expect(() => archive.recordEvent('run-2', { sequence: 2, type: 'dup', payload: {} })).toThrow(
      "Duplicate sequence number 2 for run 'run-2'",
    );
  });

  it('updates run status and stores result snapshot', () => {
    archive.startRun({ runId: 'run-3', request: canonicalTextRun });
    const updated = archive.updateStatus({
      runId: 'run-3',
      status: 'completed',
      result: {
        id: 'resp_run3',
        status: 'completed',
        output: [],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    });

    expect(updated.status).toBe('completed');
    expect(updated.result?.id).toBe('resp_run3');
  });

  it('returns timeline snapshots up to a sequence number', () => {
    archive.startRun({ runId: 'run-4', request: canonicalTextRun });
    archive.recordEvent('run-4', { type: 'response.created', payload: {} });
    archive.recordEvent('run-4', { type: 'response.output_text.delta', payload: { delta: 'Hi' } });
    archive.recordEvent('run-4', { type: 'response.output_text.done', payload: { text: 'Hi' } });

    const timeline = archive.snapshotAt('run-4', 2)!;
    expect(timeline.events).toHaveLength(2);
    expect(timeline.events[1]!.type).toBe('response.output_text.delta');
  });

  it('lists runs in reverse chronological order', () => {
    const a = archive.startRun({ runId: 'run-a', request: canonicalTextRun });
    const b = archive.startRun({ runId: 'run-b', request: canonicalTextRun });
    expect(a.createdAt <= b.createdAt).toBe(true);
    a.createdAt = new Date(a.createdAt.getTime() - 1000);
    a.updatedAt = a.createdAt;

    const runs = archive.listRuns();
    expect(runs[0]!.runId).toBe('run-b');
    expect(runs.some((run) => run.runId === 'run-a')).toBe(true);
  });
});
