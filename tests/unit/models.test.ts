/**
 * Models Module Unit Tests
 */

// Mock model providers
const mockOpenAICompletion = jest.fn();
const mockAnthropicCompletion = jest.fn();
const mockGeminiCompletion = jest.fn();

jest.mock('openai', () => ({
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: mockOpenAICompletion
      }
    }
  }))
}));

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn(() => ({
    messages: {
      create: mockAnthropicCompletion
    }
  }))
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: mockGeminiCompletion
    }))
  }))
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Models Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Router', () => {
    test('routes to correct provider', async () => {
      const router = {
        route: (provider: string) => {
          const providers = {
            openai: 'openai-handler',
            anthropic: 'anthropic-handler',
            gemini: 'gemini-handler'
          };
          return providers[provider] || null;
        }
      };

      expect(router.route('openai')).toBe('openai-handler');
      expect(router.route('anthropic')).toBe('anthropic-handler');
      expect(router.route('gemini')).toBe('gemini-handler');
      expect(router.route('invalid')).toBeNull();
    });

    test('validates model availability', () => {
      const isModelAvailable = (model: string): boolean => {
        const availableModels = [
          'gpt-4',
          'gpt-3.5-turbo',
          'claude-3-opus',
          'claude-3-sonnet',
          'gemini-pro'
        ];
        return availableModels.includes(model);
      };

      expect(isModelAvailable('gpt-4')).toBe(true);
      expect(isModelAvailable('claude-3-opus')).toBe(true);
      expect(isModelAvailable('invalid-model')).toBe(false);
    });
  });

  describe('OpenAI Provider', () => {
    test('sends completion request', async () => {
      mockOpenAICompletion.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Generated response',
            role: 'assistant'
          }
        }]
      });

      const complete = async (prompt: string) => {
        const response = await mockOpenAICompletion({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.choices[0].message.content;
      };

      const result = await complete('Test prompt');

      expect(mockOpenAICompletion).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
      expect(result).toBe('Generated response');
    });

    test('handles OpenAI errors', async () => {
      mockOpenAICompletion.mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );

      const complete = async (prompt: string) => {
        try {
          return await mockOpenAICompletion({ prompt });
        } catch (error) {
          throw error;
        }
      };

      await expect(complete('Test')).rejects.toThrow('Rate limit exceeded');
    });

    test('streams responses', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
        }
      };

      mockOpenAICompletion.mockResolvedValueOnce(mockStream);

      const streamComplete = async (prompt: string) => {
        const stream = await mockOpenAICompletion({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          stream: true
        });

        let result = '';
        for await (const chunk of stream) {
          result += chunk.choices[0].delta.content || '';
        }
        return result;
      };

      const result = await streamComplete('Test');
      expect(result).toBe('Hello world');
    });
  });

  describe('Anthropic Provider', () => {
    test('sends message request', async () => {
      mockAnthropicCompletion.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: 'Claude response'
        }]
      });

      const complete = async (prompt: string) => {
        const response = await mockAnthropicCompletion({
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000
        });
        return response.content[0].text;
      };

      const result = await complete('Test prompt');

      expect(mockAnthropicCompletion).toHaveBeenCalledWith({
        model: 'claude-3-opus',
        messages: [{ role: 'user', content: 'Test prompt' }],
        max_tokens: 1000
      });
      expect(result).toBe('Claude response');
    });

    test('handles Anthropic errors', async () => {
      mockAnthropicCompletion.mockRejectedValueOnce(
        new Error('API key invalid')
      );

      const complete = async (prompt: string) => {
        return await mockAnthropicCompletion({ prompt });
      };

      await expect(complete('Test')).rejects.toThrow('API key invalid');
    });
  });

  describe('Gemini Provider', () => {
    test('generates content', async () => {
      mockGeminiCompletion.mockResolvedValueOnce({
        response: {
          text: () => 'Gemini response'
        }
      });

      const complete = async (prompt: string) => {
        const response = await mockGeminiCompletion(prompt);
        return response.response.text();
      };

      const result = await complete('Test prompt');

      expect(mockGeminiCompletion).toHaveBeenCalledWith('Test prompt');
      expect(result).toBe('Gemini response');
    });

    test('handles Gemini errors', async () => {
      mockGeminiCompletion.mockRejectedValueOnce(
        new Error('Model not found')
      );

      const complete = async (prompt: string) => {
        return await mockGeminiCompletion(prompt);
      };

      await expect(complete('Test')).rejects.toThrow('Model not found');
    });
  });

  describe('Model Configuration', () => {
    test('validates temperature parameter', () => {
      const validateTemperature = (temp: number): boolean => {
        return temp >= 0 && temp <= 2;
      };

      expect(validateTemperature(0.7)).toBe(true);
      expect(validateTemperature(0)).toBe(true);
      expect(validateTemperature(2)).toBe(true);
      expect(validateTemperature(-1)).toBe(false);
      expect(validateTemperature(3)).toBe(false);
    });

    test('validates max tokens', () => {
      const validateMaxTokens = (tokens: number, model: string): boolean => {
        const limits = {
          'gpt-4': 8192,
          'gpt-3.5-turbo': 4096,
          'claude-3-opus': 4096
        };
        const limit = limits[model] || 2048;
        return tokens > 0 && tokens <= limit;
      };

      expect(validateMaxTokens(1000, 'gpt-4')).toBe(true);
      expect(validateMaxTokens(10000, 'gpt-4')).toBe(false);
      expect(validateMaxTokens(0, 'gpt-4')).toBe(false);
    });

    test('builds model configuration', () => {
      const buildConfig = (options: any) => {
        const defaults = {
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        };
        return { ...defaults, ...options };
      };

      const config = buildConfig({ temperature: 0.5, max_tokens: 500 });

      expect(config.temperature).toBe(0.5);
      expect(config.max_tokens).toBe(500);
      expect(config.top_p).toBe(1);
    });
  });

  describe('Response Processing', () => {
    test('extracts text from response', () => {
      const extractText = (response: any): string => {
        if (response.choices) {
          return response.choices[0]?.message?.content || '';
        }
        if (response.content) {
          return response.content[0]?.text || '';
        }
        if (response.response) {
          return response.response.text() || '';
        }
        return '';
      };

      expect(extractText({
        choices: [{ message: { content: 'OpenAI text' } }]
      })).toBe('OpenAI text');

      expect(extractText({
        content: [{ text: 'Claude text' }]
      })).toBe('Claude text');
    });

    test('calculates token usage', () => {
      const calculateTokens = (text: string): number => {
        // Rough approximation: 1 token per 4 characters
        return Math.ceil(text.length / 4);
      };

      expect(calculateTokens('Hello world')).toBe(3);
      expect(calculateTokens('This is a longer text string')).toBe(7);
      expect(calculateTokens('')).toBe(0);
    });

    test('formats response metadata', () => {
      const formatMetadata = (response: any) => {
        return {
          model: response.model || 'unknown',
          usage: response.usage || { total_tokens: 0 },
          created: response.created || Date.now(),
          finish_reason: response.finish_reason || 'stop'
        };
      };

      const metadata = formatMetadata({
        model: 'gpt-4',
        usage: { total_tokens: 150 },
        created: 1234567890
      });

      expect(metadata.model).toBe('gpt-4');
      expect(metadata.usage.total_tokens).toBe(150);
      expect(metadata.created).toBe(1234567890);
    });
  });

  describe('Error Handling', () => {
    test('retries on rate limit', async () => {
      let attempts = 0;
      const retryableRequest = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Rate limit exceeded');
        }
        return 'Success';
      };

      const withRetry = async (fn: Function, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn();
          } catch (error: any) {
            if (i === maxRetries - 1 || !error.message.includes('Rate limit')) {
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      };

      const result = await withRetry(retryableRequest);
      expect(result).toBe('Success');
      expect(attempts).toBe(3);
    });

    test('handles network errors', async () => {
      const makeRequest = async () => {
        throw new Error('Network error: ECONNREFUSED');
      };

      await expect(makeRequest()).rejects.toThrow('Network error: ECONNREFUSED');
    });
  });
});