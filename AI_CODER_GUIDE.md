# AI Coder Guide for NOFX Control Plane

This guide helps AI coding assistants (Claude, Codex, Copilot, etc.) quickly understand and work with the NOFX Control Plane codebase.

## IMPORTANT: Worktree Usage for AI Development

**ALWAYS use Git worktrees when working on this codebase with AI assistance.** This prevents conflicts and keeps the main repository clean.

### Required Worktree Workflow:

**IMPORTANT**: Worktrees should be created as subdirectories within the main repository, NOT in the parent directory!

1. **Before starting ANY work**, create a new worktree:
   ```bash
   # From the main repository (/Volumes/Development/nofx-local-starter)
   git worktree add -b feature/feature-name worktrees/feature-name
   cd worktrees/feature-name
   # You should now be in /Volumes/Development/nofx-local-starter/worktrees/feature-name
   ```

2. **During development**, work exclusively in the worktree directory

3. **After completing work**, merge and clean up:
   ```bash
   # From the worktree directory
   cd /Volumes/Development/nofx-local-starter
   git checkout main
   git merge feature/feature-name
   git push origin main

   # Clean up
   git worktree remove worktrees/feature-name
   git branch -d feature/feature-name
   ```

### Why Worktrees Are Required:
- Prevents AI from accidentally modifying the wrong branch
- Allows parallel development without conflicts
- Makes it clear what work is AI-assisted (in worktrees) vs manual (in main repo)
- Easy rollback if AI-generated code has issues
- Clean separation of concerns

**Never work directly in the main repository directory when using AI assistance!**

## Build with Claude Agent Workflow

When tackling complex problems in this codebase, follow this specialized agent workflow to leverage domain-specific expertise:

### 1. Understand the Problem
Before selecting an agent, clearly define:
- What specific task needs to be accomplished
- Which domain or technology area it falls into
- What the expected outcome should be

### 2. Select the Right Subagent
Browse available specialized agents at https://www.buildwithclaude.com/browse

Common agents for this project:
- **API Documentation Specialist** - For SDK integration, OpenAPI specs, migration guides
- **Backend System Architect** - For API design, database schemas, system architecture
- **Developer Experience (DX) Optimization Specialist** - For workflow automation, environment setup
- **Deployment Engineer** - For CI/CD pipelines, containerization, deployment strategies
- **GraphQL Architect** - For GraphQL schemas, resolvers, real-time subscriptions
- **Data Engineer** - For data pipelines, ETL processes, analytics infrastructure

### 3. Install the Selected Agent
```bash
# Check if bwc CLI is installed
bwc --version

# If not installed:
npm install -g bwc-cli

# Initialize project configuration (if needed)
bwc init --project

# Add the selected agent (example with API Documentation Specialist)
bwc add --agent api-documentation-specialist

# Or use interactive mode to browse and select
bwc add
```

### 4. Use the Agent to Solve the Problem
Once the agent is installed, it will have access to:
- The full project context
- Specialized domain knowledge
- Best practices for its specific area
- Tools and patterns specific to its expertise

### 5. Verify Agent Status
```bash
# Check what's installed
bwc status

# List all available agents
bwc list --agents

# Show only installed items
bwc list --installed
```

### Example: Claude Agent SDK Migration
For our current Phase 2 SDK migration, the workflow would be:
1. **Problem**: Replace mock SDK implementation with real Claude Agent SDK calls
2. **Agent**: API Documentation Specialist (generates SDK client libraries, migration guides)
3. **Install**: `bwc add --agent api-documentation-specialist`
4. **Execute**: Let the agent analyze the mock, research the real SDK, and implement the integration

### Best Practices
- Always use project-level configuration (`bwc init --project`) for consistency
- Document which agents were used for significant changes
- Keep agent configurations in version control
- Use specialized agents for their domains rather than general-purpose coding

## AI Guardrails — Tooling & Automation

- **Package manager**: This repo is pinned to `npm` (see `package-lock.json`). Do not swap scripts to `pnpm`/`yarn`, do not add new lockfiles, and prefer `npx` over global installs when you need CLIs.
- **Bootstrap expectations**: Use `npm run bootstrap:dev` for local setup. If you touch `scripts/bootstrap-dev.sh`, keep the Supabase start/reset, `.env` hydration, bucket creation, and Jest health check intact, and continue forcing `DEV_RESTART_WATCH=0` for non-interactive runs.
- **Start launchers**: `Start NOFX.command` and `Start DB + NOFX.command` intentionally avoid background restarts. Do not reintroduce chokidar-style watchers or flip `DEV_RESTART_WATCH` to `1` unless the user asks for interactive reloads.
- **Testing standard**: Add new specs with **Jest** under `tests/**` for centralized test organization and easier maintenance. All test files should follow consistent naming: `*.test.ts` or `*.spec.ts`. This centralized approach improves test discovery, simplifies CI/CD configuration, and provides better separation of concerns. Do not co-locate test files in `src/` directories.
- **Static analysis config**: When touching `knip.json`, point entries at real TypeScript entrypoints (`src/api/main.ts`, `src/worker/main.ts`, etc.). Never create placeholder files just to satisfy Knip.

## Quick Start - Cloud Deployment

**The NOFX Control Plane is now fully deployed to the cloud!**

- **Production URL**: https://nofx-control-plane.vercel.app
- **API Base**: https://nofx-control-plane.vercel.app/api
- **Stack**: Vercel (Frontend + Functions) + Supabase (Database)

**No local setup required for production use!** Everything runs in the cloud.

## System Overview

NOFX Control Plane is an orchestration system that turns requests into durable, auditable execution runs. It manages AI-powered code generation, quality gates, manual approvals, and deployment workflows.

**Core Purpose**: Orchestrate complex multi-step workflows with AI integration, quality checks, and human oversight.

## Architecture Summary

### Cloud Architecture (Production)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│     API     │────▶│   Queue     │
│  (Vercel)   │     │  (Vercel    │     │ (PostgreSQL)│
│             │     │  Functions) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                            │                   │
                            ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Database   │     │   Worker    │
                    │  (Supabase  │     │  (Vercel)   │
                    │  PostgreSQL)│     │             │
                    └─────────────┘     └─────────────┘
```

**Production URLs:**
- Frontend: https://nofx-control-plane.vercel.app
- API: https://nofx-control-plane.vercel.app/api/*
- Database: Supabase PostgreSQL (managed)

## Key Files and Directories

### Core API
- `src/api/main.ts` - Main Express server, run creation endpoint
- `src/api/routes/` - All API route handlers
- `src/api/planBuilder.ts` - Converts prompts to execution plans
- `src/api/loader.ts` - Dynamic route loading

### Worker System
- `src/worker/runner.ts` - Core step execution engine
- `src/worker/handlers/` - Tool implementations (codegen, gates, etc.)
- `src/worker/relay.ts` - Event relay for webhooks

### Data Layer
- `src/lib/store.ts` - Storage abstraction (filesystem/Postgres)
- `src/lib/db.ts` - Database connection and queries
- `src/lib/queue/` - Queue adapters (Redis/BullMQ, memory, SQS)
- `supabase/migrations/` - Database schema

### Models & AI
- `src/models/router.ts` - AI model routing and selection
- `src/models/providers/` - Provider implementations (OpenAI, Anthropic, etc.)
- `src/lib/models.ts` - Model configuration management

### Shared
- `src/shared/types.ts` - TypeScript type definitions
- `src/lib/events.ts` - Event recording and audit trail
- `src/lib/observability.ts` - Logging and tracing

### Frontend
- `apps/frontend/` - React SPA (if present)
- `src/ui/views/` - EJS templates for legacy UI

### Documentation
- `docs/control-plane/` - Main documentation
- `docs/control-plane/openapi.yaml` - API specification
- `docs/control-plane/API_REFERENCE.md` - Detailed API docs
- `docs/control-plane/INTEGRATION_GUIDE.md` - Integration patterns

## Environment Configuration

### Production (Vercel)

Environment variables are set in Vercel Dashboard:

```bash
# Core
NODE_ENV=production
VERCEL_ENV=production

# Database (Supabase)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Queue
QUEUE_DRIVER=postgres  # Using PostgreSQL-based queue

# Storage
DATA_DRIVER=postgres  # All data in Supabase

# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Auth
ADMIN_PASSWORD=<secure-password>
```

### Local Development

For local development, copy `.env.example` to `.env`:

```bash
cp .env.example .env
# Edit .env with your local settings
```

### Cloud Services

**Production Stack:**
- **Frontend & API**: Vercel (serverless functions)
- **Database**: Supabase PostgreSQL
- **Queue**: PostgreSQL-based (no Redis required)
- **File Storage**: Supabase Storage
- **Authentication**: Supabase Auth

**No local services required in production!** Everything runs in the cloud.

### Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Run locally:**
   ```bash
   npm run dev        # Start API server
   npm run fe:dev     # Start frontend (separate terminal)
   ```

**Local ports (development only):**
- API (Local): http://localhost:3000
- API (Production): https://nofx-control-plane.vercel.app/api
- Frontend: http://localhost:5173

## Core Concepts

### 1. Runs
A run represents a complete execution workflow with a goal and multiple steps.
- Created via `POST /runs` with either a structured plan or natural language prompt
- Tracked in `run` table with status: pending, running, succeeded, failed, cancelled
- Has associated steps, artifacts, and events

### 2. Steps
Individual units of work within a run.
- Each step has a tool (handler) that executes it
- Idempotency key prevents duplicate execution: `{runId}:{stepName}:{hash(inputs)}`
- Status progression: pending → running → succeeded/failed

### 3. Tools/Handlers
Pluggable executors for different step types:
- `codegen` - AI code generation via model router
- `gate:*` - Quality gates (typecheck, test, lint, security)
- `manual:*` - Human approval gates
- `git_pr` - GitHub pull request creation
- `db_write` - Database operations
- `deploy:*` - Deployment handlers

### 4. Artifacts
Output files from steps stored in Supabase Storage or filesystem.
- Code files, logs, images, documents
- Referenced by run_id and step_id
- Accessible via storage API

### 5. Events
Audit trail of all state changes:
- `run.created`, `step.started`, `step.finished`, etc.
- Stored in `event` table with timestamps and payloads
- Streamable via SSE endpoint

## Cloud Deployment

### Database Setup (Supabase)

1. **Create a Supabase project** at https://supabase.com
2. **Run migrations**:
   - Go to SQL Editor in Supabase Dashboard
   - Run the SQL from `run-supabase-migrations.sql`
   - This creates all required tables and views

### Deploying to Vercel

1. **Initial deployment:**
   ```bash
   vercel --prod
   ```

2. **Set environment variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add all required variables (see Environment Configuration above)
   - Redeploy to apply changes

3. **Automatic deployments:**
   - Pushing to `main` branch triggers automatic deployment
   - Preview deployments created for pull requests

### API Endpoints (Vercel Functions)

All API files in `/api` directory become serverless functions:
- `/api/health.ts` → `https://your-app.vercel.app/api/health`
- `/api/runs/index.ts` → `https://your-app.vercel.app/api/runs`

### Monitoring

- **Frontend Status**: Check https://your-app.vercel.app
- **API Health**: `curl https://your-app.vercel.app/api/health`
- **Logs**: View in Vercel Dashboard → Functions → Logs

## Common Development Tasks

### Adding a New API Endpoint

1. Create route file in `src/api/routes/`:
```typescript
// src/api/routes/myroute.ts
import { Express } from 'express';

export default function mount(app: Express) {
  app.get('/my-endpoint', async (req, res) => {
    // Implementation
    res.json({ result: 'data' });
  });
}
```

2. The loader (`src/api/loader.ts`) will auto-register it.

3. Update OpenAPI spec: `docs/control-plane/openapi.yaml`

### Creating a New Tool/Handler

1. Create handler in `src/worker/handlers/`:
```typescript
// src/worker/handlers/mytool.ts
import { StepHandler } from '../types';

export const handler: StepHandler = {
  match: (tool: string) => tool === 'mytool',

  async run(ctx) {
    const { inputs } = ctx;

    // Implementation
    const result = await doWork(inputs);

    // Store output
    await ctx.store.updateStepOutput(ctx.stepId, { result });

    // Optional: create artifact
    await ctx.store.createArtifact({
      run_id: ctx.runId,
      step_id: ctx.stepId,
      type: 'file',
      path: 'output.txt',
      metadata: { size: 100 }
    });

    return { success: true, outputs: { result } };
  }
};
```

2. Handler is auto-loaded by the runner.

### Working with the Model Router

The model router (`src/models/router.ts`) selects and calls AI models:

```typescript
import { routeCompletion } from '../models/router';

const response = await routeCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Write a function' }
  ],
  model: 'fast',  // or 'good', 'claude', 'gpt4', etc.
  temperature: 0.7,
  projectId: 'default'
});
```

### Database Operations

Use the query helper from `src/lib/db.ts`:

```typescript
import { query } from '../lib/db';

// Simple query
const runs = await query('SELECT * FROM run WHERE status = $1', ['pending']);

// With type safety
interface Run {
  id: string;
  status: string;
}
const typed = await query<Run>('SELECT * FROM run LIMIT 1');
```

### Queue Operations

Enqueue work via `src/lib/queue`:

```typescript
import { enqueue, STEP_READY_TOPIC } from '../lib/queue';

await enqueue(STEP_READY_TOPIC, {
  runId: 'run_123',
  stepId: 'step_456',
  idempotencyKey: 'unique_key'
});
```

### Event Recording

Track state changes:

```typescript
import { recordEvent } from '../lib/events';

await recordEvent(
  runId,
  'custom.event',
  { key: 'value' },  // payload
  stepId  // optional
);
```

## Testing

### Unit Tests
```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm test -- src/api     # Specific directory
```

### E2E Tests
```bash
npm run test:e2e        # Playwright tests
```

### Manual Testing
```bash
# Create a test run
curl -X POST https://nofx-control-plane.vercel.app/runs \
  -H "Content-Type: application/json" \
  -d '{"plan":{"goal":"test","steps":[{"name":"test","tool":"codegen","inputs":{"prompt":"test"}}]}}'

# Check status
curl https://nofx-control-plane.vercel.app/runs/{RUN_ID}

# View API docs
open https://nofx-control-plane.vercel.app/api-docs
```

## Best Practices & Code Standards

### Core Principles (MUST FOLLOW)

1. **Preserve Existing Functionality** - Never break existing features while adding new ones
2. **Idempotency First** - Every operation must be safe to retry
3. **Fail Gracefully** - Always handle errors, never let the system crash
4. **Audit Everything** - Record events for all state changes
5. **Security by Default** - Validate inputs, sanitize outputs, never expose secrets
6. **Small Files Only** - Never exceed 500 lines, break up at 400 lines
7. **Single Responsibility** - Each file, class, and function does ONE thing
8. **Modular Design** - Code connects like Lego blocks - interchangeable and testable

### Code Style Rules

1. **TypeScript Strict**
   - Always use types, never `any` unless absolutely necessary
   - Enable strict mode in tsconfig
   - Define interfaces for all data structures

2. **Error Handling Pattern**
   ```typescript
   // GOOD - Specific error handling with context
   try {
     const result = await operation();
     return { success: true, data: result };
   } catch (error) {
     log.error({ error, context: { runId, stepId } }, 'Operation failed');
     await recordEvent(runId, 'operation.failed', { error: error.message });
     return { success: false, error: 'Operation failed' };
   }

   // BAD - Generic catch without context
   try {
     return await operation();
   } catch (e) {
     console.error(e);
     throw e;
   }
   ```

3. **Database Queries**
   - ALWAYS use parameterized queries
   - NEVER concatenate SQL strings
   - Include error handling for constraint violations
   ```typescript
   // GOOD
   await query('SELECT * FROM run WHERE id = $1', [runId]);

   // BAD - SQL injection risk
   await query(`SELECT * FROM run WHERE id = '${runId}'`);
   ```

4. **API Responses**
   - Consistent structure across all endpoints
   - Never expose internal errors to clients
   ```typescript
   // Standard success
   res.json({ success: true, data: result });

   // Standard error
   res.status(400).json({ error: 'Validation failed', details: {...} });
   ```

5. **Async/Await Over Callbacks**
   ```typescript
   // GOOD
   const data = await fetchData();
   const result = await processData(data);

   // AVOID
   fetchData((err, data) => {
     processData(data, (err, result) => {...});
   });
   ```

### Development Workflow

1. **Before Creating New Files**
   - Check if functionality exists elsewhere
   - Prefer modifying existing files over creating new ones
   - Follow existing patterns in the codebase
   - If file is >400 lines, refactor BEFORE adding new code

2. **When Adding Features**
   - Update relevant tests
   - Add event recording for observability
   - Update OpenAPI spec if adding endpoints
   - Consider backward compatibility
   - Ensure no file exceeds 400 lines after changes

3. **Handler Development Rules**
   - Each handler must be idempotent
   - Always update step status appropriately
   - Clean up resources in finally blocks
   - Set reasonable timeouts
   - Keep handlers under 200 lines

4. **Testing Requirements**
   - Write tests for new functionality
   - Test error paths, not just happy paths
   - Include integration tests for API endpoints
   - Test idempotency explicitly
   - Each test file should test ONE class/module

### Security Standards

1. **Authentication & Authorization**
   ```typescript
   // Always check admin auth for sensitive operations
   if (!isAdmin(req)) {
     return res.status(401).json({ error: 'auth required', login: '/ui/login' });
   }
   ```

2. **Input Validation**
   ```typescript
   // Use Zod for schema validation
   const schema = z.object({
     name: z.string().min(1).max(255),
     projectId: z.string().uuid()
   });
   const validated = schema.parse(req.body);
   ```

3. **Secrets Management**
   - Never hardcode secrets
   - Use environment variables
   - Never log sensitive data
   - Mask secrets in outputs

### Performance Considerations

1. **Queue Management**
   - Implement backpressure handling
   - Set appropriate delays for retries
   - Monitor queue depth

2. **Database Operations**
   - Use connection pooling
   - Implement query timeouts
   - Add indexes for frequent queries
   - Batch operations when possible

3. **Resource Limits**
   - Set timeouts on all external calls
   - Limit payload sizes
   - Implement rate limiting for API endpoints
   - Clean up temporary files

### Documentation Requirements

1. **Code Comments**
   - Document "why", not "what"
   - Add JSDoc for public functions
   - Include examples for complex logic

2. **API Changes**
   - Update OpenAPI spec immediately
   - Include migration notes
   - Document breaking changes

3. **New Features**
   - Update this AI_CODER_GUIDE.md
   - Add integration examples
   - Document configuration options

### Common Anti-Patterns to AVOID

1. **DON'T** create duplicate functionality
2. **DON'T** bypass the queue system for async work
3. **DON'T** modify database schema without migrations
4. **DON'T** catch errors without logging context
5. **DON'T** trust user input without validation
6. **DON'T** hardcode configuration values
7. **DON'T** leave console.log statements in code
8. **DON'T** commit commented-out code
9. **DON'T** use synchronous file operations
10. **DON'T** ignore TypeScript errors with @ts-ignore
11. **DON'T** create files over 500 lines (treat as emergency)
12. **DON'T** mix business logic with infrastructure code
13. **DON'T** create God classes that do everything
14. **DON'T** put multiple responsibilities in one class
15. **DON'T** write functions over 40 lines

## File Organization & Architecture Standards

### File Size Limits (STRICT)
```
❌ NEVER: Files over 500 lines (unacceptable, fix immediately)
⚠️  WARNING: Files over 400 lines (refactor before adding features)
✅ TARGET: Files under 200 lines (optimal)
✅ IDEAL: Files under 150 lines (excellent)
```

### Function & Class Size Limits
- **Functions**: Maximum 40 lines, target 20-30 lines
- **Classes**: Maximum 200 lines, target under 150 lines
- **Methods**: Maximum 30 lines, target under 20 lines
- **Interfaces**: Maximum 50 lines (split if larger)

### Architectural Layers (MUST FOLLOW)

```
┌─────────────────────────────────────┐
│         Controllers/Routes          │  ← HTTP handling only
├─────────────────────────────────────┤
│      Coordinators/Orchestrators     │  ← Workflow coordination
├─────────────────────────────────────┤
│         Services/Managers           │  ← Business logic
├─────────────────────────────────────┤
│           Repositories              │  ← Data access only
├─────────────────────────────────────┤
│        Adapters/Providers           │  ← External integrations
└─────────────────────────────────────┘
```

### Naming Conventions & Patterns

#### Use Clear, Specific Names:
- **Controller**: Handles HTTP requests (e.g., `RunController`)
- **Coordinator**: Orchestrates complex workflows (e.g., `RunCoordinator`)
- **Service**: Contains business logic (e.g., `RunService`)
- **Manager**: Manages state/resources (e.g., `CacheManager`)
- **Repository**: Data access only (e.g., `RunRepository`)
- **Adapter**: External system integration (e.g., `RedisAdapter`)
- **Factory**: Creates objects (e.g., `StoreFactory`)
- **Validator**: Validates data (e.g., `PlanValidator`)
- **Processor**: Transforms data (e.g., `ResponseProcessor`)

### Folder Structure for Large Files

When refactoring a large file (>400 lines), use this structure:

```typescript
// BEFORE: src/lib/store.ts (582 lines - TOO LARGE!)

// AFTER: src/lib/store/
store/
├── index.ts                    # Public API (< 50 lines)
├── interfaces/                 # Contract definitions
│   ├── IRunRepository.ts      # Run operations interface
│   └── IStepRepository.ts     # Step operations interface
├── repositories/              # Data access layer
│   ├── RunRepository.ts       # Run CRUD (< 150 lines)
│   └── StepRepository.ts      # Step CRUD (< 150 lines)
├── services/                  # Business logic
│   ├── RunService.ts          # Run business rules
│   └── StepService.ts         # Step business rules
└── adapters/                  # External connections
    ├── PostgresAdapter.ts     # Database implementation
    └── FilesystemAdapter.ts  # File storage
```

### Single Responsibility Examples

#### ❌ BAD: Multiple Responsibilities
```typescript
// DON'T: God class doing everything
class RunManager {
  createRun() { /* database + validation + events + queue */ }
  validatePlan() { /* business logic */ }
  saveToDatabase() { /* data access */ }
  sendNotification() { /* external service */ }
  generateReport() { /* reporting */ }
  handleError() { /* error handling */ }
  // 500+ lines of mixed concerns
}
```

#### ✅ GOOD: Single Responsibility
```typescript
// RunController.ts - HTTP handling only (< 50 lines)
class RunController {
  constructor(private coordinator: RunCoordinator) {}
  async create(req: Request, res: Response) {
    const run = await this.coordinator.createRun(req.body);
    res.json(run);
  }
}

// RunCoordinator.ts - Orchestration only (< 100 lines)
class RunCoordinator {
  constructor(
    private service: RunService,
    private eventBus: EventBus
  ) {}
  async createRun(data: any) {
    const validated = await this.service.validate(data);
    const run = await this.service.create(validated);
    await this.eventBus.emit('run.created', run);
    return run;
  }
}

// RunService.ts - Business logic only (< 150 lines)
class RunService {
  constructor(private repository: RunRepository) {}
  async create(data: ValidatedRun) {
    // Business logic only
    return this.repository.save(data);
  }
}

// RunRepository.ts - Data access only (< 100 lines)
class RunRepository {
  async save(run: Run) {
    // Database operations only
    return query('INSERT INTO run...', [run]);
  }
}
```

### Dependency Injection Pattern

Always use dependency injection, never direct imports for services:

```typescript
// ❌ BAD: Direct import (tight coupling)
import { store } from '../lib/store';
class RunService {
  async create() {
    return store.createRun(); // Direct dependency
  }
}

// ✅ GOOD: Dependency injection (loose coupling)
class RunService {
  constructor(private store: IStore) {} // Injected dependency
  async create() {
    return this.store.createRun();
  }
}
```

### When to Split a File

Split immediately when you see:
1. File approaching 400 lines
2. Class with multiple unrelated methods
3. Mixed layers (e.g., HTTP + business logic + database)
4. Multiple classes in one file
5. Functions over 40 lines
6. Complex nested logic (> 3 levels deep)

### Refactoring Checklist

When working on existing code:
- [ ] Check file size - if >400 lines, refactor first
- [ ] Identify responsibilities - should be exactly ONE
- [ ] Extract interfaces for dependencies
- [ ] Split into appropriate layers
- [ ] Create focused, small classes
- [ ] Ensure each function < 40 lines
- [ ] Add unit tests for each new component
- [ ] Update imports gradually (maintain backward compatibility)

## Common Patterns
```typescript
app.post('/endpoint', async (req, res) => {
  try {
    const result = await doWork(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    log.error({ error }, 'Operation failed');
    res.status(500).json({ error: 'Internal error' });
  }
});
```

### Pattern: Handler with Cleanup
```typescript
export const handler: StepHandler = {
  async run(ctx) {
    let resource;
    try {
      resource = await acquire();
      const result = await process(resource);
      return { success: true, outputs: result };
    } finally {
      if (resource) await release(resource);
    }
  }
};
```

### Pattern: Retryable Operation
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
  throw lastError;
}
```

## Debugging Tips

1. **Enable debug logging**: `DEBUG=nofx:* npm run dev`
2. **Check Redis**: `redis-cli MONITOR`
3. **Database queries**: `psql $DATABASE_URL`
4. **Queue status**: `curl https://nofx-control-plane.vercel.app/dev/queue`
5. **Worker health**: `curl https://nofx-control-plane.vercel.app/dev/worker/health`
6. **View logs**: Check `local_data/logs/` or console output
7. **Inspect artifacts**: Check Supabase Storage or `local_data/artifacts/`

## Quick Command Reference

```bash
# Development
npm run dev          # Start API and worker
npm run api          # API only
npm run worker       # Worker only
npm run build        # Build TypeScript

# Database
npm run migrate      # Run migrations
npm run seed         # Seed data
supabase db reset    # Reset database

# Testing
npm test             # Unit tests
npm run test:e2e     # E2E tests
npm run test:coverage # Coverage report

# Tools
npm run create:bucket # Create storage bucket
npm run backup       # Create backup
npm run restore      # Restore backup

# Documentation
open https://nofx-control-plane.vercel.app/api-docs  # Swagger UI
```

## Important Security Notes

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Especially in handlers
3. **Use parameterized queries** - Prevent SQL injection
4. **Check authentication** - Use `isAdmin(req)` for admin endpoints
5. **Limit resource usage** - Set timeouts, memory limits
6. **Sanitize outputs** - Especially when displaying user content

## Getting Help

1. **API Documentation**: `docs/control-plane/API_REFERENCE.md`
2. **Integration Examples**: `docs/control-plane/INTEGRATION_GUIDE.md`
3. **OpenAPI Spec**: `docs/control-plane/openapi.yaml`
4. **Type Definitions**: `src/shared/types.ts`
5. **Environment Setup**: `.env.example`

## Key Principles

- **Idempotency**: Operations should be safe to retry
- **Observability**: Log everything, emit events for state changes
- **Resilience**: Handle failures gracefully, implement retries
- **Security**: Defense in depth, validate everything
- **Modularity**: Handlers and routes are pluggable
- **Testability**: Write testable code with clear interfaces

## System Boundaries & Constraints

### What This System DOES
- Orchestrates multi-step workflows with AI integration
- Provides durable, auditable execution with exactly-once semantics
- Manages quality gates and manual approvals
- Handles artifact storage and event streaming
- Routes between multiple AI providers intelligently

### What This System DOES NOT DO
- Direct code execution (uses sandboxed handlers only)
- Real-time collaborative editing
- Version control (integrates with Git, doesn't replace it)
- Container orchestration (not a Kubernetes replacement)
- CI/CD pipeline management (orchestrates, doesn't replace Jenkins/GH Actions)

## Critical Data Flows

### Run Creation Flow
```
1. API receives request → 2. Build/validate plan → 3. Create run record
→ 4. Generate idempotency keys → 5. Create step records → 6. Emit events
→ 7. Enqueue steps → 8. Return run ID to client
```

### Step Execution Flow
```
1. Worker pulls from queue → 2. Check idempotency → 3. Mark running
→ 4. Load handler → 5. Execute with timeout → 6. Store outputs
→ 7. Create artifacts → 8. Update status → 9. Emit events
```

### Critical Files You MUST Understand
- `src/lib/store.ts` - How data persistence works (abstraction layer)
- `src/worker/runner.ts` - Core execution engine (step lifecycle)
- `src/api/main.ts` - API entry point and run creation
- `src/models/router.ts` - AI model selection logic
- `src/lib/queue/adapters/` - Queue implementations

## State Management

### Run States
```
pending → running → [succeeded|failed|cancelled]
```

### Step States
```
pending → running → [succeeded|failed|cancelled]
         ↘ waiting (for dependencies/gates)
```

### Important State Invariants
- A run cannot succeed if any required step failed
- Steps with same idempotency key execute exactly once
- Manual gates block until approved or waived
- Failed steps can be retried (creates new step record)

## Error Recovery Patterns

### Retryable Errors
- Network timeouts
- Rate limit errors (429)
- Temporary AI provider errors
- Database connection errors

### Non-Retryable Errors
- Invalid credentials (401)
- Validation errors (400)
- Insufficient permissions (403)
- Business logic violations

### Recovery Implementation
```typescript
// Check if error is retryable
function isRetryable(error: Error): boolean {
  if (error.message.includes('ECONNREFUSED')) return true;
  if (error.message.includes('rate limit')) return true;
  if ((error as any).status === 429) return true;
  if ((error as any).status >= 500) return true;
  return false;
}
```

## Current Limitations & TODOs

- Multi-tenancy is partially implemented (tenant_id exists but not enforced)
- Rate limiting is not yet implemented
- WebSocket support for real-time updates (currently using SSE)
- Distributed tracing is basic (OpenTelemetry integration in progress)
- Handler dependency resolution is simple (no complex DAG support yet)
- No built-in rollback mechanism (manual intervention required)
- Queue doesn't support priority levels
- No automatic retry backoff configuration per handler

## Troubleshooting Decision Tree

### Production (Cloud)

#### "The run isn't starting"
1. Check API health: `curl https://nofx-control-plane.vercel.app/api/health`
2. Check Vercel Functions logs in dashboard
3. Verify database connection in health endpoint response
4. Check Supabase for queue entries: SQL Editor → `SELECT * FROM nofx.queue_jobs WHERE status = 'pending'`
5. Look for idempotency conflicts in database

#### "The step is stuck"
1. Check step status in Supabase: `SELECT * FROM nofx.step WHERE id = ?`
2. Check for manual gates blocking: `SELECT * FROM nofx.gate WHERE step_id = ?`
3. Look for handler errors in Vercel logs
4. Check if handler has timeout set (Vercel Functions max: 60s)
5. Verify worker function is deployed

#### "Getting 500 errors"
1. Check Vercel Functions logs for stack traces
2. Verify Supabase connection (check health endpoint)
3. Ensure all environment variables are set in Vercel
4. Check for CORS issues if calling from different domain

#### "Database offline error"
1. Run migrations: Execute `run-supabase-migrations.sql` in Supabase SQL Editor
2. Verify environment variables in Vercel:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - DATABASE_URL
3. Check Supabase project is active and not paused

### Local Development

#### "The run isn't starting"
1. Check API health: `curl https://nofx-control-plane.vercel.app/health`
2. Check worker health: `curl https://nofx-control-plane.vercel.app/dev/worker/health`
3. Ensure `.env` file exists with correct values
4. Verify database connection
5. Check queue driver setting in `.env`
5. Look for unhandled promise rejections

### "AI generation not working"
1. Verify API keys are set correctly
2. Check model router configuration
3. Look for rate limit errors
4. Test with different model selection
5. Check provider service status

## Quick Wins for New Contributors

If you're new to the codebase, here are impactful areas to start:

1. **Add missing TypeScript types** - Search for `any` types
2. **Improve error messages** - Make them more descriptive
3. **Add test coverage** - Look for untested handlers
4. **Document complex functions** - Add JSDoc comments
5. **Fix TODO comments** - Search for `TODO` in codebase
6. **Add event tracking** - Find state changes without events
7. **Improve validation** - Add Zod schemas for inputs
8. **Optimize queries** - Look for N+1 query problems
9. **Add retry logic** - For external API calls
10. **Enhance logging** - Add context to error logs

## Project Philosophy

This project follows these philosophical principles:

1. **"Make it work, make it right, make it fast"** - In that order
2. **"Explicit is better than implicit"** - Clear code over clever code
3. **"Fail loudly in development, gracefully in production"**
4. **"Every action should be auditable"** - Leave a trail
5. **"Idempotency is not optional"** - Design for retry from day one
6. **"The queue is the source of truth"** - Not the database status
7. **"Handlers should be pure functions when possible"**
8. **"Configuration over code changes"** - Make it configurable

## When Making Changes

1. **Update tests** when changing functionality
2. **Update OpenAPI spec** when changing API endpoints
3. **Add events** for important state changes
4. **Consider idempotency** for all operations
5. **Check error handling** paths
6. **Update this guide** if adding new patterns or concepts
7. **Run the linter** before committing
8. **Test locally** with a real run before pushing

## Final Checklist Before Contributing

### Code Quality
- [ ] Code follows TypeScript strict mode
- [ ] Error handling includes context logging
- [ ] Database queries use parameters
- [ ] No console.log statements left
- [ ] Linter passes without warnings

### Architecture & Organization
- [ ] No file exceeds 400 lines (CRITICAL)
- [ ] No function exceeds 40 lines
- [ ] No class exceeds 200 lines
- [ ] Each file has single responsibility
- [ ] Proper layer separation (Controller → Service → Repository)
- [ ] Dependencies injected, not imported directly
- [ ] Business logic separated from infrastructure

### Testing & Documentation
- [ ] Tests written for new functionality
- [ ] Each test file tests ONE module
- [ ] Idempotency considered and tested
- [ ] New endpoints added to OpenAPI spec
- [ ] Documentation updated if needed

### Security & Performance
- [ ] Security implications reviewed
- [ ] Input validation implemented
- [ ] No hardcoded secrets
- [ ] Resource cleanup in finally blocks
- [ ] Timeouts set for external calls

---

*This guide is the primary reference for AI coders working on NOFX. For API usage and integration, see `docs/control-plane/`. For specific implementation details, refer to the source code. When in doubt, preserve existing functionality and ask for clarification.*
