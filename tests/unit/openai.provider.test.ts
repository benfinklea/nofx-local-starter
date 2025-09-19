import type { ResponsesRequest } from '../../src/shared/openai/responsesSchemas';

const mockResponsesCreate = jest.fn();
const mockChatCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
    chat: { completions: { create: mockChatCreate } },
  })),
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { openaiChat } = require('../../src/models/providers/openai');

describe('openaiChat', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'test-key', OPENAI_ALLOW_TEMPERATURE: undefined };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends a validated Responses request and returns assistant text', async () => {
    mockResponsesCreate.mockResolvedValue({
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
              text: 'hello from responses',
            },
          ],
        },
      ],
      usage: {
        input_tokens: 42,
        output_tokens: 10,
        total_tokens: 52,
      },
    });

    const result = await openaiChat('plan my week', 'gpt-4.1-mini', { maxOutputTokens: 256 });

    expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
    const callPayload = mockResponsesCreate.mock.calls[0][0] as ResponsesRequest;
    expect(callPayload).toMatchObject({
      model: 'gpt-4.1-mini',
      max_output_tokens: 256,
      input: 'plan my week',
    });
    expect(result.text).toEqual('hello from responses');
    expect(result.usage).toMatchObject({ inputTokens: 42, outputTokens: 10, totalTokens: 52 });
  });

  it('falls back to chat completions when Responses rejects supported parameters', async () => {
    mockResponsesCreate.mockRejectedValueOnce(new Error('Unsupported parameter temperature'));
    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'fallback answer',
          },
        },
      ],
      usage: {
        prompt_tokens: 5,
        completion_tokens: 3,
        total_tokens: 8,
      },
    });

    const result = await openaiChat('hi there', 'gpt-3.5-turbo', { maxOutputTokens: 50 });

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    expect(result.text).toEqual('fallback answer');
    expect(result.usage).toMatchObject({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
  });

  it('includes temperature when explicitly allowed', async () => {
    process.env.OPENAI_ALLOW_TEMPERATURE = '1';
    mockResponsesCreate.mockResolvedValue({
      id: 'resp_temp',
      status: 'completed',
      output: [],
    });

    await openaiChat('test temperature');

    const callPayload = mockResponsesCreate.mock.calls[0][0] as ResponsesRequest;
    expect(callPayload.temperature).toBe(0.2);
  });

  it('rethrows non-unsupported errors from Responses API', async () => {
    const err = new Error('rate limit reached');
    mockResponsesCreate.mockRejectedValueOnce(err);

    await expect(openaiChat('trigger error')).rejects.toThrow('rate limit reached');
    expect(mockChatCreate).not.toHaveBeenCalled();
  });
});
