import { z } from 'zod';

const inputTextPartSchema = z.object({
  type: z.literal('input_text'),
  text: z.string().min(1, 'input_text requires text'),
});

const inputImagePartSchema = z.object({
  type: z.literal('input_image'),
  image_url: z.string().url('image_url must be a valid URL'),
  detail: z.enum(['low', 'high', 'auto']).optional(),
});

const inputFilePartSchema = z.object({
  type: z.literal('input_file'),
  file_id: z.string().min(1),
});

const inputAudioPartSchema = z.object({
  type: z.literal('input_audio'),
  audio: z.string().min(1),
  format: z.enum(['wav', 'mp3']).optional(),
});

const toolCallDeltaSchema = z.object({
  type: z.literal('tool_call_delta'),
  call_id: z.string(),
  delta: z.string(),
});

const reasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string().optional(),
});

const contentPartSchema = z.union([
  inputTextPartSchema,
  inputImagePartSchema,
  inputFilePartSchema,
  inputAudioPartSchema,
  reasoningPartSchema,
  toolCallDeltaSchema,
]);

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'developer']),
  content: z
    .array(contentPartSchema)
    .min(1, 'content requires at least one part'),
});

const functionToolSchema = z
  .object({
    type: z.literal('function'),
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.unknown().optional(),
  })
  .strict();

const builtInToolSchema = z
  .object({
    type: z.enum(['web_search', 'file_search', 'code_interpreter', 'computer', 'mcp']),
    name: z.string().optional(),
    instructions: z.string().optional(),
  })
  .passthrough();

const toolSchema = z.union([functionToolSchema, builtInToolSchema]);

const metadataSchema = z
  .record(z.string(), z.string())
  .superRefine((value, ctx) => {
    const keys = Object.keys(value);
    if (keys.length > 16) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'metadata supports at most 16 keys' });
    }
  });

export const responsesRequestSchema = z
  .object({
    model: z.string().min(1, 'model is required'),
    input: z.union([z.string().min(1), z.array(messageSchema)]).optional(),
    instructions: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    conversation: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]).optional(),
    previous_response_id: z.string().min(1).optional(),
    metadata: metadataSchema.optional(),
    service_tier: z.enum(['auto', 'default', 'flex', 'priority']).optional(),
    parallel_tool_calls: z.boolean().optional(),
    tools: z.array(toolSchema).max(16).optional(),
    tool_choice: z
      .union([
        z.literal('auto'),
        z.literal('none'),
        z.literal('required'),
        z.object({ type: z.literal('function'), function: z.object({ name: z.string().min(1) }) }),
      ])
      .optional(),
    max_tool_calls: z.number().int().positive().max(16).optional(),
    max_output_tokens: z.number().int().positive().optional(),
    reasoning: z
      .object({
        effort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
      })
      .optional(),
    store: z.boolean().optional(),
    background: z.boolean().optional(),
    include: z.array(z.string()).optional(),
  })
  .strict();

const outputTextPartSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: z.array(z.unknown()).optional(),
});

const outputAudioPartSchema = z.object({
  type: z.literal('output_audio'),
  transcript: z.string().optional(),
  audio: z.string().optional(),
});

const toolCallSchema = z.object({
  type: z.literal('tool_call'),
  id: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed']).optional(),
  name: z.string().optional(),
  arguments: z.string().optional(),
  output: z.string().optional(),
});

const assistantMessageSchema = z.object({
  type: z.literal('message'),
  id: z.string(),
  role: z.literal('assistant'),
  status: z.enum(['in_progress', 'completed', 'failed']).optional(),
  content: z
    .array(z.union([outputTextPartSchema, outputAudioPartSchema, toolCallDeltaSchema, reasoningPartSchema]))
    .optional(),
});

export const responsesUsageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    input_tokens_details: z.record(z.string(), z.number()).optional(),
    output_tokens_details: z.record(z.string(), z.number()).optional(),
    cached_tokens: z.number().int().nonnegative().optional(),
  })
  .partial();

export const responsesResultSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'incomplete']).default('queued'),
  output: z.array(z.union([assistantMessageSchema, toolCallSchema])).optional(),
  usage: responsesUsageSchema.optional(),
  model: z.string().optional(),
  metadata: metadataSchema.optional(),
});

export type ResponsesRequest = z.infer<typeof responsesRequestSchema>;
export type ResponsesTool = z.infer<typeof toolSchema>;
export type ResponsesResult = z.infer<typeof responsesResultSchema>;

export const canonicalTextRun: ResponsesRequest = responsesRequestSchema.parse({
  model: 'gpt-4.1-mini',
  instructions: 'You are a helpful assistant that summarizes weekly planning notes into task lists.',
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: 'Summarize the following meeting transcript into three action items and one risk.',
        },
        {
          type: 'input_file',
          file_id: 'file_abc123',
        },
      ],
    },
  ],
  tools: [
    {
      type: 'function',
      name: 'persist_action_items',
      description: 'Persist structured action items to the run timeline store.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                dueDate: { type: 'string', format: 'date-time' },
              },
              required: ['title'],
            },
          },
        },
        required: ['items'],
      },
    },
  ],
  metadata: {
    runId: 'demo-run',
    tenant: 'internal',
  },
  parallel_tool_calls: true,
  service_tier: 'auto',
});

export function validateResponsesRequest(payload: unknown): ResponsesRequest {
  return responsesRequestSchema.parse(payload);
}

export function validateResponsesResult(payload: unknown): ResponsesResult {
  return responsesResultSchema.parse(payload);
}
