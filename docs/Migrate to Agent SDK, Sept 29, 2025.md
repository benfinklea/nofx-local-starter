# Migration to Claude Agent SDK - September 29, 2025

## Executive Summary

**Date:** September 29, 2025
**Status:** Phase 1 - In Progress
**Agent SDK Version:** @anthropic-ai/claude-agent-sdk@0.1.0
**Claude Model:** claude-sonnet-4-5 (Released today)

This document outlines the strategic migration from custom NOFX infrastructure to a hybrid architecture that leverages the Claude Agent SDK while preserving NOFX's unique orchestration capabilities.

## Strategic Decision

### What We're Keeping (NOFX Orchestration Layer)
- ✅ **Multi-step workflow orchestration** - Plan creation, step dependencies
- ✅ **Quality gates system** - typecheck, lint, test, SAST, secrets, audit
- ✅ **Manual approval workflows** - Human-in-the-loop gates
- ✅ **Queue management** - BullMQ/Redis for async execution
- ✅ **Database persistence** - PostgreSQL state management
- ✅ **Event system** - Audit trail and timeline
- ✅ **Git integrations** - PR creation, worktree management
- ✅ **Registry system** - Agent/template marketplace
- ✅ **Multi-provider routing** - OpenAI, Anthropic, Gemini abstraction

### What We're Migrating to Agent SDK
- 🔄 **Memory & Context Management** → SDK Sessions
- 🔄 **Streaming Responses** → SDK Async Generators
- 🔄 **Subagent Coordination** → SDK Native Subagents
- 🔄 **Cost Tracking** → SDK Built-in Metrics
- 🔄 **Tool Execution** → SDK Tool Framework
- 🔄 **Permission Management** → SDK Permission Modes

### Time Savings
- **9-12 weeks** of development avoided
- **Production-ready** session management (4-6 weeks saved)
- **Native subagent support** (3-4 weeks saved)
- **Better streaming patterns** (2 weeks saved)

## Architecture

### Hybrid Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    NOFX Control Plane                    │
│                  (Orchestration Layer)                    │
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │   Plans    │  │   Gates    │  │  Approvals │         │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │
│        │                │                │                 │
│        └────────────────┼────────────────┘                │
│                         ▼                                  │
│              ┌─────────────────────┐                      │
│              │   Queue (BullMQ)    │                      │
│              └──────────┬──────────┘                      │
│                         ▼                                  │
│              ┌─────────────────────┐                      │
│              │   Runner Engine     │                      │
│              └──────────┬──────────┘                      │
└───────────────────────────┼──────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │   AgentSdkAdapter     │ ← NEW
                │  (Integration Layer)  │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Sessions   │    │   Streaming  │    │  Subagents   │
│  (Memory)    │    │  (Responses) │    │ (Hierarchy)  │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                ┌───────────▼───────────┐
                │  Claude Agent SDK     │
                │  @anthropic-ai/       │
                │  claude-agent-sdk     │
                └───────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  Claude Sonnet 4.5    │
                └───────────────────────┘
```

## Phase 1: Foundation (Week 1-2)

### 1.1 Create Adapter Layer

**File:** `src/lib/agentSdk/adapter.ts`

```typescript
import { query, tool, type Options } from '@anthropic-ai/claude-agent-sdk';
import { recordEvent } from '../events';
import { log } from '../logger';
import type { Step } from '../../worker/handlers/types';

export interface AgentSdkContext {
  runId: string;
  model?: string;
  sessionMemory?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export class AgentSdkAdapter {
  /**
   * Execute a step using the Agent SDK instead of custom model router
   */
  async executeWithSdk(
    step: Step,
    context: AgentSdkContext
  ): Promise<any> {
    const sessionId = context.runId; // Map NOFX run to SDK session

    const options: Options = {
      model: context.model || 'claude-sonnet-4-5',
      sessionId, // SDK handles session persistence
      maxTokens: context.maxTokens || 4096,
      temperature: context.temperature || 0.7,
      tools: this.buildTools(step),
      hooks: this.buildHooks(step, context),
    };

    log.info({
      runId: context.runId,
      stepId: step.id,
      model: options.model,
      sessionId,
    }, 'Executing step with Agent SDK');

    const prompt = this.buildPrompt(step);
    const result = query(prompt, options);

    let finalResponse = '';
    let tokensUsed = 0;
    let cost = 0;

    // Stream responses and emit events
    for await (const message of result) {
      // Record streaming events for NOFX timeline
      await recordEvent(
        context.runId,
        'sdk.message',
        {
          type: message.type,
          content: message.content?.substring(0, 200), // Preview
          stepId: step.id,
        },
        step.id
      );

      if (message.type === 'text') {
        finalResponse += message.content;
      }

      // SDK provides cost tracking
      if (message.usage) {
        tokensUsed = message.usage.total_tokens;
        cost = this.calculateCost(tokensUsed, options.model);
      }
    }

    return {
      response: finalResponse,
      metadata: {
        tokensUsed,
        cost,
        model: options.model,
        sessionId,
      },
    };
  }

  /**
   * Build prompt from step inputs
   */
  private buildPrompt(step: Step): string {
    const inputs = step.inputs || {};

    if (inputs.prompt) {
      return String(inputs.prompt);
    }

    if (inputs.topic && inputs.bullets) {
      const bullets = Array.isArray(inputs.bullets)
        ? inputs.bullets.join('\n- ')
        : '';
      return `Write about: ${inputs.topic}\n\nInclude these points:\n- ${bullets}`;
    }

    return `Execute tool: ${step.tool}`;
  }

  /**
   * Build SDK tools from step configuration
   */
  private buildTools(step: Step): any[] {
    const tools = [];

    // Add built-in SDK tools based on step requirements
    if (step.inputs?._tools?.includes('bash')) {
      tools.push({ type: 'bash' });
    }

    if (step.inputs?._tools?.includes('file_edit')) {
      tools.push({ type: 'file_edit' });
    }

    if (step.inputs?._tools?.includes('web_search')) {
      tools.push({ type: 'web_search' });
    }

    return tools;
  }

  /**
   * Build SDK hooks for lifecycle events
   */
  private buildHooks(step: Step, context: AgentSdkContext): any {
    return {
      onToolCall: async (toolCall: any) => {
        await recordEvent(
          context.runId,
          'sdk.tool_call',
          { tool: toolCall.name, args: toolCall.args },
          step.id
        );
      },
      onToolResult: async (result: any) => {
        await recordEvent(
          context.runId,
          'sdk.tool_result',
          { success: result.success },
          step.id
        );
      },
    };
  }

  /**
   * Calculate cost based on tokens and model
   */
  private calculateCost(tokens: number, model: string): number {
    const rates: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5': { input: 3, output: 15 }, // $3/$15 per million
      'claude-opus-4': { input: 15, output: 75 },
      'claude-haiku-3-5': { input: 0.80, output: 4 },
    };

    const rate = rates[model] || rates['claude-sonnet-4-5'];
    // Assume 50/50 input/output split
    return ((tokens / 2) * rate.input + (tokens / 2) * rate.output) / 1_000_000;
  }
}
```

### 1.2 Create SDK-Powered Handler

**File:** `src/worker/handlers/codegen_v2.ts`

```typescript
import type { StepHandler } from './types';
import { store } from '../../lib/store';
import { recordEvent } from '../../lib/events';
import { log } from '../../lib/logger';
import { AgentSdkAdapter } from '../../lib/agentSdk/adapter';

/**
 * SDK-powered code generation handler
 * Uses Agent SDK instead of custom model router
 */
export const handler: StepHandler = {
  match: (tool: string) => tool === 'codegen:v2',

  async run({ runId, step }) {
    log.info({ runId, stepId: step.id, tool: step.tool }, 'Starting SDK-powered codegen');

    try {
      const adapter = new AgentSdkAdapter();

      // Execute with Agent SDK
      const result = await adapter.executeWithSdk(step, {
        runId,
        model: step.inputs?.model || 'claude-sonnet-4-5',
        sessionMemory: true, // SDK persists session automatically
        temperature: step.inputs?.temperature || 0.7,
      });

      // Store artifact (NOFX continues to handle storage)
      const filename = step.inputs?.filename || 'generated.md';
      const artifactPath = `${runId}/${step.id}/${filename}`;

      await store.createArtifact({
        run_id: runId,
        step_id: step.id,
        type: 'file',
        path: artifactPath,
        content: result.response,
        metadata: {
          filename,
          ...result.metadata,
        },
      });

      // Update step with outputs
      await store.updateStep(step.id, {
        status: 'succeeded',
        outputs: {
          artifactPath,
          filename,
          tokensUsed: result.metadata.tokensUsed,
          cost: result.metadata.cost,
          model: result.metadata.model,
          sessionId: result.metadata.sessionId,
        },
        ended_at: new Date().toISOString(),
      });

      await recordEvent(
        runId,
        'codegen.completed',
        {
          artifact: artifactPath,
          tokensUsed: result.metadata.tokensUsed,
          cost: result.metadata.cost,
        },
        step.id
      );

      log.info({
        runId,
        stepId: step.id,
        tokensUsed: result.metadata.tokensUsed,
        cost: result.metadata.cost,
      }, 'SDK-powered codegen completed');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      log.error({ error, runId, stepId: step.id }, 'SDK codegen failed');

      await store.updateStep(step.id, {
        status: 'failed',
        outputs: { error: message },
        ended_at: new Date().toISOString(),
      });

      await recordEvent(runId, 'codegen.failed', { error: message }, step.id);

      throw error;
    }
  },
};

export default handler;
```

### 1.3 Add Feature Flag Support

**File:** `src/worker/handlers/codegen.ts` (Update existing)

```typescript
// Add at the top
import { AgentSdkAdapter } from '../../lib/agentSdk/adapter';

// Modify run method
async run({ runId, step }) {
  const useAgentSdk = process.env.USE_AGENT_SDK === 'true';

  if (useAgentSdk) {
    // NEW: Agent SDK execution path
    log.info({ runId, stepId: step.id }, 'Using Agent SDK for codegen');
    return this.executeWithSdk(runId, step);
  } else {
    // EXISTING: Original model router execution
    log.info({ runId, stepId: step.id }, 'Using legacy model router');
    return this.executeWithModelRouter(runId, step);
  }
}

// Add new method
private async executeWithSdk(runId: string, step: Step) {
  const adapter = new AgentSdkAdapter();
  const result = await adapter.executeWithSdk(step, {
    runId,
    model: step.inputs?.model,
    sessionMemory: true,
  });

  // Handle artifacts and outputs (same as before)
  const filename = step.inputs?.filename || 'generated.md';
  // ... rest of artifact handling
}

// Keep existing method
private async executeWithModelRouter(runId: string, step: Step) {
  // Existing implementation unchanged
}
```

### 1.4 Database Schema Updates

**File:** `supabase/migrations/20250929_add_agent_sdk_support.sql`

```sql
-- Add session tracking columns to run table
ALTER TABLE nofx.run ADD COLUMN IF NOT EXISTS sdk_session_id TEXT;
ALTER TABLE nofx.run ADD COLUMN IF NOT EXISTS sdk_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_run_sdk_session ON nofx.run(sdk_session_id);

-- Add SDK-specific event types
COMMENT ON COLUMN nofx.event.type IS
  'Event type: run.*, step.*, sdk.message, sdk.tool_call, sdk.tool_result, etc.';

-- Add cost tracking to step outputs
COMMENT ON COLUMN nofx.step.outputs IS
  'Step outputs including tokensUsed, cost, model, sessionId for SDK steps';

-- Create view for SDK usage analytics
CREATE OR REPLACE VIEW nofx.sdk_usage_stats AS
SELECT
  DATE_TRUNC('day', r.created_at) as date,
  COUNT(DISTINCT r.id) as total_runs,
  COUNT(DISTINCT r.sdk_session_id) as sdk_runs,
  SUM((s.outputs->>'tokensUsed')::int) as total_tokens,
  SUM((s.outputs->>'cost')::numeric) as total_cost,
  AVG((s.outputs->>'tokensUsed')::int) as avg_tokens_per_step
FROM nofx.run r
LEFT JOIN nofx.step s ON s.run_id = r.id
WHERE r.sdk_session_id IS NOT NULL
GROUP BY DATE_TRUNC('day', r.created_at)
ORDER BY date DESC;
```

### 1.5 Environment Configuration

**File:** `.env` (Add new variables)

```bash
# Agent SDK Configuration
USE_AGENT_SDK=false                    # Feature flag (start with false)
AGENT_SDK_MODEL=claude-sonnet-4-5      # Default model
AGENT_SDK_SESSION_PERSIST=true         # Enable session persistence
AGENT_SDK_MAX_TOKENS=4096              # Default max tokens
AGENT_SDK_TEMPERATURE=0.7              # Default temperature

# Cost tracking thresholds
AGENT_SDK_COST_ALERT_THRESHOLD=10.00   # Alert when cost exceeds $10
AGENT_SDK_COST_DAILY_LIMIT=100.00      # Daily spending limit
```

## Phase 2: Testing & Validation (Week 3)

### 2.1 Create Integration Tests

**File:** `tests/integration/agent-sdk.test.ts`

```typescript
import { AgentSdkAdapter } from '../../src/lib/agentSdk/adapter';
import { store } from '../../src/lib/store';
import type { Step } from '../../src/worker/handlers/types';

describe('Agent SDK Integration', () => {
  let adapter: AgentSdkAdapter;

  beforeEach(() => {
    adapter = new AgentSdkAdapter();
  });

  describe('AgentSdkAdapter', () => {
    it('should execute simple prompt', async () => {
      const step: Step = {
        id: 'test-step-1',
        run_id: 'test-run-1',
        name: 'test',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Say hello',
        },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'test-run-1',
        model: 'claude-sonnet-4-5',
      });

      expect(result.response).toBeTruthy();
      expect(result.metadata.model).toBe('claude-sonnet-4-5');
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.cost).toBeGreaterThan(0);
    });

    it('should persist session across multiple calls', async () => {
      const runId = 'test-run-session';
      const step1: Step = {
        id: 'step-1',
        run_id: runId,
        name: 'first',
        tool: 'codegen:v2',
        inputs: { prompt: 'Remember the number 42' },
      };

      const step2: Step = {
        id: 'step-2',
        run_id: runId,
        name: 'second',
        tool: 'codegen:v2',
        inputs: { prompt: 'What number did I tell you to remember?' },
      };

      await adapter.executeWithSdk(step1, { runId, sessionMemory: true });
      const result2 = await adapter.executeWithSdk(step2, { runId, sessionMemory: true });

      expect(result2.response).toContain('42');
    });

    it('should track costs accurately', async () => {
      const step: Step = {
        id: 'cost-test',
        run_id: 'test-run-cost',
        name: 'cost',
        tool: 'codegen:v2',
        inputs: { prompt: 'Write a short poem' },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'test-run-cost',
        model: 'claude-sonnet-4-5',
      });

      expect(result.metadata.cost).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);

      // Verify cost calculation
      const expectedCost = result.metadata.tokensUsed * 9 / 2_000_000; // Average of $3/$15
      expect(result.metadata.cost).toBeCloseTo(expectedCost, 4);
    });
  });

  describe('codegen:v2 handler', () => {
    it('should create artifact using SDK', async () => {
      const runId = 'test-run-handler';
      const stepId = 'test-step-handler';

      const run = await store.createRun(
        {
          goal: 'Test SDK handler',
          steps: [
            {
              name: 'generate',
              tool: 'codegen:v2',
              inputs: {
                topic: 'Testing',
                bullets: ['Unit tests', 'Integration tests'],
                filename: 'test.md',
              },
            },
          ],
        },
        'test-project'
      );

      // Wait for step to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      const steps = await store.listStepsByRun(run.id);
      const step = steps.find(s => s.tool === 'codegen:v2');

      expect(step?.status).toBe('succeeded');
      expect(step?.outputs?.sessionId).toBeTruthy();
      expect(step?.outputs?.cost).toBeGreaterThan(0);

      const artifacts = await store.listArtifactsByRun(run.id);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].path).toContain('test.md');
    });
  });
});
```

### 2.2 Manual Testing Plan

1. **Enable Feature Flag**
   ```bash
   # In .env
   USE_AGENT_SDK=true
   ```

2. **Test Simple Codegen**
   ```bash
   curl -X POST http://localhost:3000/runs \
     -H "Content-Type: application/json" \
     -d '{
       "plan": {
         "goal": "Test Agent SDK",
         "steps": [{
           "name": "sdk-test",
           "tool": "codegen:v2",
           "inputs": {
             "topic": "Agent SDK Migration",
             "bullets": ["Testing", "Integration", "Success"],
             "filename": "sdk-test.md"
           }
         }]
       }
     }'
   ```

3. **Test Session Persistence**
   ```bash
   # Create run with multiple steps
   curl -X POST http://localhost:3000/runs \
     -H "Content-Type: application/json" \
     -d '{
       "plan": {
         "goal": "Test session memory",
         "steps": [
           {
             "name": "remember",
             "tool": "codegen:v2",
             "inputs": {"prompt": "Remember: Project Phoenix"}
           },
           {
             "name": "recall",
             "tool": "codegen:v2",
             "inputs": {"prompt": "What project name did I mention?"}
           }
         ]
       }
     }'
   ```

4. **Verify Cost Tracking**
   ```bash
   # Check SDK usage stats
   curl http://localhost:3000/dev/sdk-stats
   ```

## Phase 3: Gradual Rollout (Week 4)

### 3.1 Rollout Strategy

1. **Week 1:** Internal testing with `USE_AGENT_SDK=true`
2. **Week 2:** Canary deployment (10% of runs)
3. **Week 3:** Progressive rollout (50% of runs)
4. **Week 4:** Full rollout (100% of runs)
5. **Week 5:** Deprecate legacy model router

### 3.2 Monitoring Checklist

- [ ] SDK session creation rate
- [ ] Average tokens per request
- [ ] Cost per run comparison (SDK vs legacy)
- [ ] Error rates (SDK vs legacy)
- [ ] Session persistence success rate
- [ ] Streaming latency metrics

### 3.3 Rollback Plan

If issues occur:
1. Set `USE_AGENT_SDK=false` in environment
2. Restart workers
3. Legacy model router takes over immediately
4. No data loss (sessions stored in DB)

## Benefits Realized

### Development Time Saved
- ✅ **Session Management:** 4-6 weeks → 0 days (SDK provides)
- ✅ **Streaming Infrastructure:** 2 weeks → 1 day (SDK async generators)
- ✅ **Cost Tracking:** 1 week → 0 days (SDK built-in)
- ✅ **Subagent Coordination:** 3-4 weeks → Future (SDK ready)
- **Total Saved:** 9-12 weeks of development

### Production Benefits
- ✅ **Better Session Management:** Automatic persistence
- ✅ **Improved Streaming:** Proper backpressure, type-safe
- ✅ **Native Cost Tracking:** No manual calculation
- ✅ **Future-Proof:** SDK updates benefit us automatically
- ✅ **Reduced Maintenance:** Less custom code to maintain

### What We Keep
- ✅ **NOFX Orchestration:** Multi-step workflows, dependencies
- ✅ **Quality Gates:** typecheck, lint, test, SAST, security
- ✅ **Manual Approvals:** Human-in-the-loop governance
- ✅ **Queue System:** Async execution, retries, idempotency
- ✅ **Event System:** Complete audit trail
- ✅ **Git Integration:** PR creation, worktree management
- ✅ **Registry:** Agent/template marketplace

## Success Metrics

### Phase 1 Complete When:
- [x] Agent SDK installed and configured
- [ ] AgentSdkAdapter implemented and tested
- [ ] codegen:v2 handler working end-to-end
- [ ] Session persistence verified
- [ ] Cost tracking accurate
- [ ] Feature flag toggle working
- [ ] Integration tests passing
- [ ] Documentation complete

### Phase 2 Complete When:
- [ ] All integration tests passing
- [ ] Manual test scenarios validated
- [ ] Cost comparison favorable
- [ ] Error rates acceptable
- [ ] Session memory working across steps

### Production Ready When:
- [ ] 1000+ successful runs with Agent SDK
- [ ] Cost per run within budget
- [ ] Error rate < 1%
- [ ] Session persistence > 99%
- [ ] Rollback plan tested
- [ ] Team trained on new system

## Next Steps

1. **Immediate (Today)**
   - [x] Install Agent SDK
   - [ ] Create adapter layer
   - [ ] Implement codegen:v2 handler
   - [ ] Add database migrations

2. **This Week**
   - [ ] Write integration tests
   - [ ] Manual testing with feature flag
   - [ ] Document SDK usage patterns
   - [ ] Train team on new architecture

3. **Next Week**
   - [ ] Canary deployment (10%)
   - [ ] Monitor metrics
   - [ ] Progressive rollout

4. **Future Phases**
   - [ ] Add subagent support (Phase 2)
   - [ ] Implement advanced streaming (Phase 3)
   - [ ] Build agent marketplace (Phase 4)

## Conclusion

This hybrid architecture gives us the best of both worlds:

- **NOFX Orchestration:** Unique workflow management, gates, approvals
- **Agent SDK Execution:** Production-ready AI capabilities, session management, streaming

We keep our competitive advantages while accelerating development by 9-12 weeks. The gradual migration approach ensures zero downtime and easy rollback if needed.

---

**Document Owner:** AI Migration Team
**Last Updated:** September 29, 2025
**Review Date:** October 6, 2025
**Status:** Phase 1 In Progress