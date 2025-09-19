import { ConversationStateManager, InMemoryConversationStore } from '../../src/services/responses/conversationStateManager';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';

describe('ConversationStateManager', () => {
  it('returns stateless context by default', async () => {
    const manager = new ConversationStateManager(new InMemoryConversationStore());
    const context = await manager.prepareContext({ tenantId: 'tenant-a', runId: 'run1' });
    expect(context.storeFlag).toBe(false);
    expect(context.conversation).toBeUndefined();
  });

  it('creates and stores vendor conversation when policy requires it', async () => {
    const store = new InMemoryConversationStore();
    const manager = new ConversationStateManager(store, { strategy: 'vendor' });

    const context = await manager.prepareContext({ tenantId: 'tenant-b', runId: 'run2' });
    expect(context.storeFlag).toBe(true);
    expect(context.conversation).toBe('conv_run2');

    // Second run should reuse existing conversation id
    const second = await manager.prepareContext({ tenantId: 'tenant-b', runId: 'run3' });
    expect(second.conversation).toBe('conv_run2');
    expect(second.previousResponseId).toBeUndefined();

    await context.cleanup?.();
    expect(store.get('tenant:tenant-b:conversation')).toBeNull();
  });

  it('respects explicit previous response id when supplied', async () => {
    const manager = new ConversationStateManager(new InMemoryConversationStore(), { strategy: 'vendor' });
    const context = await manager.prepareContext({
      tenantId: 'tenant-c',
      runId: 'run4',
      previousResponseId: 'resp_prev',
    });
    expect(context.previousResponseId).toBe('resp_prev');
  });
});
