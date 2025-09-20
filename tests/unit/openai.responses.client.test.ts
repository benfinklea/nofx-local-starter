import type { ResponsesRequest } from '../../src/shared/openai/responsesSchemas';

type HeadersLike = { forEach: (callback: (value: string, key: string) => void) => void };

const mockWithResponse = jest.fn();
const mockResponsesCreate = jest.fn().mockImplementation(() => ({ withResponse: mockWithResponse }));

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
  })),
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OpenAIResponsesClient } = require('../../src/services/responses/openaiClient');

describe('OpenAIResponsesClient', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWithResponse.mockReset();
    mockResponsesCreate.mockClear();
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: 'test-key' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns validated responses data and lowercases headers', async () => {
    const headers: HeadersLike = {
      forEach: (callback) => {
        callback('req-123', 'X-Request-Id');
        callback('application/json', 'content-type');
      },
    };

    const data = {
      id: 'resp_123',
      status: 'completed',
      output: [],
      usage: {
        input_tokens: 5,
        output_tokens: 3,
        total_tokens: 8,
      },
    };

    mockWithResponse.mockResolvedValue({ data, response: { headers } });

    const client = new OpenAIResponsesClient();
    const request: ResponsesRequest = { model: 'gpt-4.1-mini', input: 'hello world' };
    const result = await client.create(request);

    expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
    expect(mockResponsesCreate.mock.calls[0][0]).toMatchObject({ model: 'gpt-4.1-mini', input: 'hello world' });
    expect(result.result).toEqual(data);
    expect(result.headers).toEqual({ 'x-request-id': 'req-123', 'content-type': 'application/json' });
  });

  it('throws when the API key is missing', () => {
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: '' };
    expect(() => new OpenAIResponsesClient()).toThrow('OPENAI_API_KEY is required to execute Responses runs');
  });
});
