import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';
import { ResponsesEventRouter } from '../../src/shared/responses/eventRouter';

describe('ResponsesEventRouter', () => {
  let archive: InMemoryResponsesArchive;

  beforeEach(() => {
    archive = new InMemoryResponsesArchive();
    archive.startRun({ runId: 'run-router', request: canonicalTextRun });
  });

  it('records events with increasing sequence numbers', () => {
    const router = new ResponsesEventRouter({ runId: 'run-router', archive });
    router.handleEvent({ type: 'response.created', sequence_number: 1 });
    router.handleEvent({ type: 'response.output_text.delta', sequence_number: 2, delta: 'Hi' });

    const timeline = archive.getTimeline('run-router')!;
    expect(timeline.events).toHaveLength(2);
    expect(timeline.events[1]!.type).toBe('response.output_text.delta');
  });

  it('rejects out-of-order or duplicate sequences', () => {
    const router = new ResponsesEventRouter({ runId: 'run-router', archive });
    router.handleEvent({ type: 'response.created', sequence_number: 5 });
    expect(() => router.handleEvent({ type: 'response.output_text.delta', sequence_number: 5 })).toThrow(
      'sequence 5 already recorded for run run-router',
    );
    expect(() => router.handleEvent({ type: 'response.output_text.delta', sequence_number: 4 })).toThrow(
      'sequence 4 is stale for run run-router',
    );
  });

  it('updates run status based on response events and stores result', () => {
    const router = new ResponsesEventRouter({ runId: 'run-router', archive });
    router.handleEvent({ type: 'response.created', sequence_number: 1 });
    const resultPayload = {
      id: 'resp-router',
      status: 'completed',
      output: [],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };
    router.handleEvent({
      type: 'response.completed',
      sequence_number: 2,
      response: resultPayload,
    });

    const run = archive.getRun('run-router')!;
    expect(run.status).toBe('completed');
    expect(run.result?.id).toBe('resp-router');
  });
});
