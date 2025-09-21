import { describe, expect, it } from '@jest/globals';
import {
  canonicalTextRun,
  validateResponsesRequest,
  validateResponsesResult,
} from '../../src/shared/openai/responsesSchemas';

describe('Responses API contract', () => {
  it('accepts the canonical text run payload', () => {
    const request = validateResponsesRequest(canonicalTextRun);
    expect(request.model).toBe('gpt-4.1-mini');
    expect(request.tools?.[0]).toMatchObject({ name: 'persist_action_items' });
  });

  it('rejects metadata with more than 16 keys', () => {
    const bigMeta = Object.fromEntries(Array.from({ length: 17 }).map((_, idx) => [`k${idx}`, String(idx)]));

    expect(() =>
      validateResponsesRequest({
        model: 'gpt-4o',
        metadata: bigMeta,
      }),
    ).toThrow('metadata supports at most 16 keys');
  });

  it('validates basic response payloads', () => {
    const response = validateResponsesResult({
      id: 'resp_123',
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: 'Here are your action items.',
            },
          ],
        },
      ],
      usage: {
        input_tokens: 120,
        output_tokens: 48,
        total_tokens: 168,
      },
    });

    expect(response.output?.[0]).toMatchObject({ id: 'msg_1' });
    expect(response.usage?.total_tokens).toBe(168);
  });

  it('accepts reasoning output items', () => {
    const response = validateResponsesResult({
      id: 'resp_reasoning',
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          status: 'completed',
          reasoning: [
            {
              type: 'reasoning',
              text: 'Summarized chain-of-thought',
            },
          ],
        },
      ],
    });

    expect(response.output?.[0]).toMatchObject({ type: 'reasoning', id: 'reasoning_1' });
  });
});
