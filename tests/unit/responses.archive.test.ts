import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';

describe('InMemoryResponsesArchive', () => {
  const archive = new InMemoryResponsesArchive();

  it('stores a run and prevents duplicates', () => {
    const run = archive.startRun({ runId: 'run-1', request: canonicalTextRun });
    expect(run.status).toBe('queued');

    expect(() => archive.startRun({ runId: 'run-1', request: canonicalTextRun })).toThrow(
      'run run-1 already exists',
    );
  });

  it('records ordered events with auto-incremented sequence', () => {
    archive.startRun({ runId: 'run-2', request: canonicalTextRun });
    const first = archive.recordEvent('run-2', { type: 'response.created', payload: { id: 'resp_1' } });
    expect(first.sequence).toBe(1);
    const second = archive.recordEvent('run-2', { type: 'response.output_text.delta', payload: { delta: 'Hi' } });
    expect(second.sequence).toBe(2);

    expect(() => archive.recordEvent('run-2', { sequence: 2, type: 'dup', payload: {} })).toThrow(
      'sequence 2 already recorded for run run-2',
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
    expect(timeline.events[1].type).toBe('response.output_text.delta');
  });
});
