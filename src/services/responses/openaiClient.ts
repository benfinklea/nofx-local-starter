import OpenAI from 'openai';
import { validateResponsesResult } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import type { ResponsesClient } from './runCoordinator';

/**
 * Minimal client wrapper that enforces parsed Responses payloads and exposes response headers.
 */
export class OpenAIResponsesClient implements ResponsesClient {
  private readonly client: OpenAI;

  constructor(options?: { apiKey?: string; baseURL?: string }) {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required to execute Responses runs');
    }
    this.client = new OpenAI({ apiKey, baseURL: options?.baseURL ?? process.env.OPENAI_BASE_URL });
  }

  // The runtime never requests streaming, so keep the signature narrow with stream:false.
  async create(request: ResponsesRequest & { stream?: false }): Promise<{ result: ResponsesResult; headers?: Record<string, string> }> {
    const promise = this.client.responses.create(request as any);
    const { data, response } = await promise.withResponse();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return {
      result: validateResponsesResult(data),
      headers,
    };
  }
}
