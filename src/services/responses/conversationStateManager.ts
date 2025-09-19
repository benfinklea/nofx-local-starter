export interface ConversationStateStore {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, ttlSeconds?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

type ConversationStrategy = 'vendor' | 'stateless';

export interface ConversationPolicy {
  strategy: ConversationStrategy;
  ttlSeconds?: number;
}

export interface ConversationStateOptions {
  tenantId: string;
  runId: string;
  existingConversationId?: string;
  previousResponseId?: string;
  policy?: ConversationPolicy;
}

export interface ConversationContext {
  conversation?: string;
  storeFlag: boolean;
  previousResponseId?: string;
  cleanup?: () => Promise<void> | void;
}

const DEFAULT_POLICY: ConversationPolicy = { strategy: 'stateless' };

const storeKey = (tenantId: string) => `tenant:${tenantId}:conversation`;

export class ConversationStateManager {
  constructor(private readonly store: ConversationStateStore, private readonly defaultPolicy: ConversationPolicy = DEFAULT_POLICY) {}

  async prepareContext(options: ConversationStateOptions): Promise<ConversationContext> {
    const policy = options.policy ?? this.defaultPolicy;
    if (policy.strategy === 'stateless') {
      return {
        storeFlag: false,
        previousResponseId: options.previousResponseId,
      };
    }

    const key = storeKey(options.tenantId);
    const existing = options.existingConversationId ?? (await this.store.get(key));

    if (!existing) {
      const generated = `conv_${options.runId}`;
      await this.store.set(key, generated, policy.ttlSeconds);
      return {
        conversation: generated,
        storeFlag: true,
        previousResponseId: options.previousResponseId,
        cleanup: async () => {
          await this.store.delete(key);
        },
      };
    }

    return {
      conversation: existing,
      storeFlag: true,
      previousResponseId: options.previousResponseId,
      cleanup: async () => {
        await this.store.delete(key);
      },
    };
  }
}

export class InMemoryConversationStore implements ConversationStateStore {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}
