# Claude Code Features - Technical Implementation Guide

## Quick Win Implementations for NOFX Control Plane

### 1. Enhanced Test Handlers (1-2 days)

**Current State**: Single `test:echo` handler
**Proposed Addition**: Specialized test handlers for different scenarios

```typescript
// src/worker/handlers/test_validate.ts
import type { StepHandler } from "./types";

const handler: StepHandler = {
  match: (tool) => tool === 'test:validate',
  async run({ runId, step }) {
    // Validate inputs against schema
    const validation = validateSchema(step.inputs);
    const outputs = {
      valid: validation.success,
      errors: validation.errors,
      timestamp: new Date().toISOString()
    };
    await store.updateStep(step.id, {
      status: validation.success ? 'succeeded' : 'failed',
      outputs
    });
  }
};

// src/worker/handlers/test_healthcheck.ts
const healthcheckHandler: StepHandler = {
  match: (tool) => tool === 'test:healthcheck',
  async run({ runId, step }) {
    const checks = {
      database: await checkDatabase(),
      queue: await checkQueue(),
      models: await checkModels(),
      storage: await checkStorage()
    };
    const allHealthy = Object.values(checks).every(c => c.status === 'ok');
    await store.updateStep(step.id, {
      status: allHealthy ? 'succeeded' : 'failed',
      outputs: { checks }
    });
  }
};
```

### 2. Correlation ID System (2-3 days)

**Integration Points**: Events, logs, queue messages

```typescript
// src/lib/correlation.ts
export function generateCorrelationId(prefix = 'corr'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function withCorrelation<T extends (...args: any[]) => any>(
  fn: T,
  correlationId?: string
): T {
  return ((...args) => {
    const id = correlationId || generateCorrelationId();
    return AsyncLocalStorage.run({ correlationId: id }, () => fn(...args));
  }) as T;
}

// Update src/lib/events.ts
export async function recordEvent(
  runId: string,
  type: string,
  payload: unknown,
  stepId?: string
) {
  const correlationId = AsyncLocalStorage.getStore()?.correlationId;
  await store.createEvent(runId, type, {
    ...payload,
    correlationId
  }, stepId);

  // Log with correlation
  log.info({
    runId,
    type,
    correlationId,
    stepId
  }, 'Event recorded');
}
```

### 3. Template System (3-4 days)

**Database Schema Addition**:
```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  plan JSONB NOT NULL,
  metadata JSONB,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_usage ON templates(usage_count DESC);
```

**API Endpoints**:
```typescript
// src/api/routes/templates.ts
export default function mountTemplates(app: Express) {
  // List templates
  app.get('/templates', async (req, res) => {
    const category = req.query.category as string;
    const templates = await store.listTemplates({ category });
    res.json({ templates });
  });

  // Get template
  app.get('/templates/:id', async (req, res) => {
    const template = await store.getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });
    res.json(template);
  });

  // Create run from template
  app.post('/templates/:id/instantiate', async (req, res) => {
    const template = await store.getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });

    // Merge template with user inputs
    const plan = mergePlanWithInputs(template.plan, req.body.inputs);

    // Create run using existing logic
    const run = await store.createRun(plan, req.body.projectId || 'default');

    // Track usage
    await store.incrementTemplateUsage(req.params.id);

    res.status(201).json({ id: run.id, fromTemplate: req.params.id });
  });
}
```

### 4. Usage Analytics (3-4 days)

**Metrics Collection**:
```typescript
// src/lib/metrics.ts
export interface UsageMetrics {
  runId: string;
  stepId?: string;
  handler: string;
  tokensUsed?: number;
  cost?: number;
  durationMs: number;
  model?: string;
  success: boolean;
  errorType?: string;
}

export async function recordMetrics(metrics: UsageMetrics) {
  await store.createMetric(metrics);

  // Real-time aggregation
  await updateDailyAggregates(metrics);

  // Alert on anomalies
  if (metrics.cost && metrics.cost > COST_THRESHOLD) {
    await notifyHighCost(metrics);
  }
}

// src/api/routes/analytics.ts
app.get('/analytics/usage', async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const usage = await store.getUsageMetrics({
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string),
    groupBy: groupBy as 'hour' | 'day' | 'week'
  });

  res.json({
    usage,
    summary: {
      totalRuns: usage.reduce((sum, u) => sum + u.runs, 0),
      totalCost: usage.reduce((sum, u) => sum + u.cost, 0),
      averageDuration: usage.reduce((sum, u) => sum + u.avgDuration, 0) / usage.length
    }
  });
});
```

### 5. Model Routing Engine (1 week)

**Routing Configuration**:
```typescript
// src/lib/modelRouter.ts
interface RoutingRule {
  condition: (context: RunContext) => boolean;
  model: string;
  reason: string;
}

const ROUTING_RULES: RoutingRule[] = [
  {
    condition: (ctx) => ctx.estimatedTokens > 100000,
    model: 'claude-3-opus',
    reason: 'Long context requires Opus'
  },
  {
    condition: (ctx) => ctx.tool === 'test:echo',
    model: 'claude-3-haiku',
    reason: 'Simple task can use Haiku'
  },
  {
    condition: (ctx) => ctx.priority === 'low' && ctx.estimatedCost < 0.01,
    model: 'claude-3-haiku',
    reason: 'Low priority, low cost task'
  },
  {
    condition: (ctx) => ctx.requiresReasoning,
    model: 'claude-3-sonnet',
    reason: 'Complex reasoning required'
  }
];

export function selectModel(context: RunContext): ModelSelection {
  for (const rule of ROUTING_RULES) {
    if (rule.condition(context)) {
      log.info({
        model: rule.model,
        reason: rule.reason,
        context
      }, 'Model selected by routing rule');

      return {
        model: rule.model,
        reason: rule.reason,
        fallbacks: getFallbackModels(rule.model)
      };
    }
  }

  // Default
  return {
    model: 'claude-3-sonnet',
    reason: 'Default model',
    fallbacks: ['claude-3-haiku']
  };
}
```

## Medium-Term Implementations

### 6. Progressive Requirements Gathering (1-2 weeks)

**Questionnaire Engine**:
```typescript
// src/lib/requirements.ts
interface Question {
  id: string;
  text: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  default?: any;
  dependsOn?: {
    questionId: string;
    value: any;
  };
  validator?: (value: any) => boolean;
}

export class RequirementsGatherer {
  private questions: Question[];
  private answers: Map<string, any> = new Map();

  async gatherRequirements(sessionId: string): Promise<Plan> {
    // Phase 1: Context questions
    const contextQuestions = this.getContextQuestions();
    for (const q of contextQuestions) {
      const answer = await this.askQuestion(q, sessionId);
      this.answers.set(q.id, answer);
    }

    // Phase 2: Analyze codebase
    const codebaseAnalysis = await this.analyzeCodebase(this.answers);

    // Phase 3: Technical questions
    const technicalQuestions = this.getTechnicalQuestions(codebaseAnalysis);
    for (const q of technicalQuestions) {
      const answer = await this.askQuestion(q, sessionId);
      this.answers.set(q.id, answer);
    }

    // Generate plan
    return this.generatePlan(this.answers, codebaseAnalysis);
  }

  private async askQuestion(
    question: Question,
    sessionId: string
  ): Promise<any> {
    // Send question via SSE
    await this.sendQuestionToClient(sessionId, question);

    // Wait for answer (with timeout)
    const answer = await this.waitForAnswer(sessionId, question.id);

    // Use default if "idk" or timeout
    if (answer === 'idk' || !answer) {
      return question.default || this.getSmartDefault(question);
    }

    // Validate
    if (question.validator && !question.validator(answer)) {
      throw new Error(`Invalid answer for ${question.id}`);
    }

    return answer;
  }
}
```

### 7. Session Checkpointing (1-2 weeks)

**Checkpoint Management**:
```typescript
// src/lib/checkpoints.ts
interface Checkpoint {
  id: string;
  runId: string;
  stepIndex: number;
  state: {
    completedSteps: string[];
    artifacts: ArtifactRef[];
    outputs: Record<string, any>;
  };
  createdAt: Date;
  description?: string;
}

export class CheckpointManager {
  async createCheckpoint(
    runId: string,
    description?: string
  ): Promise<Checkpoint> {
    const run = await store.getRun(runId);
    const steps = await store.listStepsByRun(runId);
    const artifacts = await store.listArtifactsByRun(runId);

    const checkpoint: Checkpoint = {
      id: generateId(),
      runId,
      stepIndex: steps.filter(s => s.status === 'succeeded').length,
      state: {
        completedSteps: steps
          .filter(s => s.status === 'succeeded')
          .map(s => s.id),
        artifacts: artifacts.map(a => ({
          id: a.id,
          path: a.path,
          hash: a.hash
        })),
        outputs: steps.reduce((acc, s) => {
          if (s.outputs) acc[s.id] = s.outputs;
          return acc;
        }, {})
      },
      createdAt: new Date(),
      description
    };

    await store.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  async restoreFromCheckpoint(
    checkpointId: string,
    newRunId?: string
  ): Promise<string> {
    const checkpoint = await store.getCheckpoint(checkpointId);
    const originalRun = await store.getRun(checkpoint.runId);

    // Create new run from checkpoint
    const run = await store.createRun(
      originalRun.plan,
      originalRun.projectId,
      {
        fromCheckpoint: checkpointId,
        parentRun: checkpoint.runId
      }
    );

    // Restore state
    for (const stepId of checkpoint.state.completedSteps) {
      const originalStep = await store.getStep(stepId);
      await store.createStep(
        run.id,
        originalStep.name,
        originalStep.tool,
        originalStep.inputs,
        undefined,
        {
          status: 'succeeded',
          outputs: checkpoint.state.outputs[stepId],
          restoredFrom: checkpointId
        }
      );
    }

    // Copy artifacts
    for (const artifact of checkpoint.state.artifacts) {
      await store.copyArtifact(artifact.id, run.id);
    }

    return run.id;
  }

  async forkRun(
    runId: string,
    fromStep: number,
    modifications?: Partial<Plan>
  ): Promise<string> {
    // Create checkpoint at specified step
    const checkpoint = await this.createCheckpoint(runId);

    // Restore with modifications
    const newRunId = await this.restoreFromCheckpoint(checkpoint.id);

    if (modifications) {
      await store.updateRunPlan(newRunId, modifications);
    }

    return newRunId;
  }
}
```

## Advanced Implementations

### 8. Multi-Agent Orchestration (3-4 weeks)

**Agent Hierarchy System**:
```typescript
// src/lib/agents/hierarchy.ts
interface Agent {
  id: string;
  role: 'coordinator' | 'specialist' | 'worker';
  capabilities: string[];
  model: string;
  maxConcurrency: number;
}

export class AgentOrchestrator {
  private agents: Map<string, Agent>;
  private activeTasks: Map<string, AgentTask>;

  async delegateTask(
    task: Task,
    parentAgent?: string
  ): Promise<TaskResult> {
    // Select appropriate agent
    const agent = this.selectAgent(task, parentAgent);

    // Check concurrency limits
    await this.waitForCapacity(agent);

    // Create subtasks if needed
    const subtasks = this.decomposeTask(task, agent);

    if (subtasks.length > 1) {
      // Parallel execution
      const results = await Promise.all(
        subtasks.map(st => this.executeWithAgent(agent, st))
      );
      return this.mergeResults(results);
    } else {
      // Single task execution
      return this.executeWithAgent(agent, task);
    }
  }

  private selectAgent(task: Task, parentAgent?: string): Agent {
    // Scoring system
    const scores = Array.from(this.agents.values()).map(agent => ({
      agent,
      score: this.scoreAgent(agent, task, parentAgent)
    }));

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    return scores[0].agent;
  }

  private scoreAgent(
    agent: Agent,
    task: Task,
    parentAgent?: string
  ): number {
    let score = 0;

    // Capability match
    const capabilityMatch = task.requiredCapabilities.filter(
      cap => agent.capabilities.includes(cap)
    ).length;
    score += capabilityMatch * 10;

    // Role appropriateness
    if (task.complexity === 'high' && agent.role === 'coordinator') {
      score += 20;
    } else if (task.complexity === 'low' && agent.role === 'worker') {
      score += 20;
    }

    // Affinity to parent
    if (parentAgent && this.hasAffinity(agent.id, parentAgent)) {
      score += 15;
    }

    // Current load (inverse)
    const load = this.getAgentLoad(agent.id);
    score -= load * 5;

    return score;
  }
}
```

### 9. Context Engineering System (4-6 weeks)

**Product Requirements Prompt (PRP) System**:
```typescript
// src/lib/context/prp.ts
interface PRP {
  id: string;
  name: string;
  context: {
    businessGoals: string[];
    technicalConstraints: string[];
    examples: CodeExample[];
    documentation: DocRef[];
    validationRules: ValidationRule[];
  };
  implementation: {
    steps: ImplementationStep[];
    testStrategy: TestStrategy;
    rolloutPlan: RolloutPlan;
  };
}

export class PRPEngine {
  async generatePRP(
    requirements: Requirements
  ): Promise<PRP> {
    // Analyze requirements
    const analysis = await this.analyzeRequirements(requirements);

    // Gather context
    const context = await this.gatherContext(analysis);

    // Generate implementation plan
    const implementation = await this.planImplementation(
      analysis,
      context
    );

    // Create validation gates
    const validation = this.createValidationGates(
      implementation,
      context
    );

    return {
      id: generateId(),
      name: requirements.name,
      context,
      implementation: {
        ...implementation,
        validation
      }
    };
  }

  async executePRP(
    prp: PRP,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const executor = new PRPExecutor(prp);

    // Pre-execution validation
    await executor.validatePreConditions();

    // Execute with gates
    const results = [];
    for (const step of prp.implementation.steps) {
      // Execute step
      const result = await executor.executeStep(step);
      results.push(result);

      // Validate against gates
      const gateResult = await this.checkGates(
        step,
        result,
        prp.context.validationRules
      );

      if (!gateResult.passed) {
        // Rollback if needed
        if (options.rollbackOnFailure) {
          await executor.rollback(results);
        }
        throw new GateFailureError(gateResult);
      }
    }

    // Post-execution validation
    await executor.validatePostConditions();

    return {
      success: true,
      results,
      metrics: executor.getMetrics()
    };
  }
}
```

## Implementation Priority Matrix

| Feature | Effort | Value | Risk | Priority |
|---------|--------|-------|------|----------|
| Enhanced Test Handlers | Low | Medium | Low | **High** |
| Correlation IDs | Low | High | Low | **High** |
| Template System | Medium | High | Low | **High** |
| Usage Analytics | Medium | High | Low | **High** |
| Model Routing | Medium | High | Medium | **Medium** |
| Requirements Gathering | High | High | Medium | **Medium** |
| Checkpointing | High | Medium | Medium | **Medium** |
| Multi-Agent | Very High | High | High | **Low** |
| Context Engineering | Very High | Very High | High | **Low** |

## Next Steps

1. **Week 1-2**: Implement low-hanging fruit (test handlers, correlation IDs)
2. **Week 3-4**: Deploy template system and analytics
3. **Month 2**: Add model routing and requirements gathering
4. **Month 3**: Implement checkpointing and begin multi-agent design
5. **Quarter 2**: Full multi-agent and context engineering systems

## Testing Strategy

Each feature should include:
- Unit tests with >90% coverage
- Integration tests for API endpoints
- Load tests for performance-critical features
- E2E tests for user-facing workflows

## Monitoring Requirements

Track these metrics for each new feature:
- Adoption rate
- Error rate
- Performance impact
- User satisfaction (via feedback)
- Cost impact (for model routing)

This implementation guide provides concrete code examples and architectural patterns that can be directly applied to the NOFX Control Plane, with realistic effort estimates and clear prioritization.