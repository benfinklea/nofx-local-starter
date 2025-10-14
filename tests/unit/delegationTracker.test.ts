import { describe, expect, it } from '@jest/globals';
import { DelegationTracker } from '../../src/services/responses/delegationTracker';
import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';

describe('DelegationTracker', () => {
  it('records and updates delegation records from events', async () => {
    const archive = new InMemoryResponsesArchive();
    archive.startRun({ runId: 'run-delegation', request: canonicalTextRun });
    const tracker = new DelegationTracker({ archive });

    tracker.handleEvent('run-delegation', {
      type: 'response.function_call_arguments.done',
      call_id: 'call-tool',
      name: 'delegate_agent',
      arguments: '{"task":"organize"}',
    } as any);

    let delegations = tracker.getDelegations('run-delegation');
    expect(delegations).toHaveLength(1);
    expect(delegations[0]!.toolName).toBe('delegate_agent');
    expect(delegations[0]!.status).toBe('requested');
    expect(delegations[0]!.arguments).toMatchObject({ task: 'organize' });

    tracker.handleEvent('run-delegation', {
      type: 'response.output_item.done',
      item: { id: 'call-tool', type: 'tool_call', status: 'completed', output: { result: 'ok' } },
    } as any);

    delegations = tracker.getDelegations('run-delegation');
    expect(delegations).toHaveLength(1);
    expect(delegations[0]!.status).toBe('completed');
    expect(delegations[0]!.output).toMatchObject({ result: 'ok' });
  });
});
