# NOFX Backplane Functionality Plan
## How the Control Plane Handles GitHub Repositories and File Changes

**Version:** 1.0.0
**Last Updated:** October 2024
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Core Functionality Breakdown](#core-functionality-breakdown)
   - [Repository Management](#repository-management)
   - [File Generation and Storage](#file-generation-and-storage)
   - [Git Integration](#git-integration)
   - [Workflow Orchestration](#workflow-orchestration)
4. [API and Integration Points](#api-and-integration-points)
5. [Configuration and Deployment](#configuration-and-deployment)
6. [Security and Best Practices](#security-and-best-practices)
7. [Use Cases and Examples](#use-cases-and-examples)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Troubleshooting and Debugging](#troubleshooting-and-debugging)
10. [Appendices](#appendices)

---

## Executive Summary

### Problem Statement

The NOFX Control Plane needs to seamlessly handle code generation, file management, and GitHub repository operations while maintaining safety, auditability, and user-friendliness for both technical and non-technical users.

### Solution Overview

The backplane implements a sophisticated orchestration system that:
- **Never directly modifies** GitHub repositories, instead using isolated workspaces
- **Employs a two-stage artifact system** where content is generated first, then optionally copied to project workspaces
- **Provides progressive disclosure** with three Git modes (hidden, basic, advanced) to accommodate different user expertise levels
- **Ensures safety** through worktrees, branches, and pull request workflows

### Key Capabilities

✅ **Automated Repository Management** - Clone, initialize, and manage Git repositories
✅ **Isolated Workspace Operations** - Sandboxed environments prevent accidental damage
✅ **Intelligent File Handling** - Two-stage artifact system with persistence options
✅ **Adaptive Git Integration** - UI complexity scales with user expertise
✅ **Complete Audit Trail** - Every operation is logged and reversible
✅ **Cloud-Native Architecture** - Seamlessly works with Vercel and Supabase

### Target Audience

- **Developers** - Full Git control and advanced features
- **Entrepreneurs** - Simple "Save" and "Update" operations
- **System Architects** - Extensible handler system
- **DevOps Teams** - Clear deployment and monitoring paths

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER LAYER                           │
│  Web UI (React) | API Clients | CLI Tools | GitHub Actions  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                      API GATEWAY                             │
│         Express.js | Authentication | Rate Limiting          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  ORCHESTRATION LAYER                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │   Run    │  │   Plan   │  │  Queue   │  │  Event   │  │
│   │ Manager  │  │ Builder  │  │ Manager  │  │  Relay   │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    EXECUTION LAYER                           │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │ Codegen  │  │Workspace │  │  Git Ops │  │   Gate    │  │
│   │ Handler  │  │  Writer  │  │  Handler │  │ Handlers  │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    STORAGE LAYER                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │Workspace │  │ Artifact │  │   Store  │  │    Git    │  │
│   │ Manager  │  │  Storage │  │   (DB)   │  │Repository │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Component Dependencies

```mermaid
graph TD
    API[API Layer] --> RM[Run Manager]
    RM --> QB[Queue Manager]
    QB --> WR[Worker/Runner]
    WR --> H[Handlers]
    H --> WM[Workspace Manager]
    H --> AS[Artifact Storage]
    WM --> GIT[Git Operations]
    AS --> SUP[Supabase Storage]
    AS --> FS[Local Filesystem]
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React, TypeScript | User interface |
| API | Express.js, Node.js | REST API server |
| Queue | BullMQ/Redis, PostgreSQL | Task processing |
| Storage | PostgreSQL, Supabase | Data persistence |
| Git | simple-git | Repository operations |
| AI | OpenAI, Anthropic | Code generation |
| Cloud | Vercel, Supabase | Production hosting |

---

## Core Functionality Breakdown

### Repository Management

#### Workspace Modes

The system supports three distinct workspace modes to accommodate different use cases:

##### 1. Local Path Mode (`local_path`)
```typescript
{
  workspace_mode: 'local_path',
  local_path: '/Users/developer/my-project'
}
```
- **Use Case**: Existing local projects
- **Location**: User's specified directory
- **Isolation**: None - direct file access
- **Best For**: Trusted local development

##### 2. Clone Mode (`clone`)
```typescript
{
  workspace_mode: 'clone',
  repo_url: 'https://github.com/user/repo.git'
}
```
- **Use Case**: Working with remote repositories
- **Location**: `local_data/workspaces/{project-id}/`
- **Isolation**: Separate clone per project
- **Best For**: Safe experimentation

##### 3. Worktree Mode (`worktree`)
```typescript
{
  workspace_mode: 'worktree',
  repo_url: 'https://github.com/user/repo.git'
}
```
- **Use Case**: Multiple parallel experiments
- **Location**: `local_data/workspaces/{project-id}/worktrees/`
- **Isolation**: Git worktrees for branches
- **Best For**: Feature development

#### Workspace Initialization Flow

```typescript
// WorkspaceManager.ensureWorkspace() flow
async ensureWorkspace(project: Project): Promise<string> {
  1. Determine workspace path based on mode
  2. Check if already initialized
  3. If repo_url exists:
     - Clone repository with authentication
     - Set up default branch
  4. Else:
     - Initialize new git repository
     - Create initial README
     - Make initial commit
  5. Mark project as initialized
  6. Return workspace path
}
```

### File Generation and Storage

#### Two-Stage Artifact System

The system employs a sophisticated two-stage process for file handling:

##### Stage 1: Artifact Generation
```typescript
// Handler generates content
const content = await generateWithAI(prompt);

// Save as artifact
const artifactPath = await saveArtifact(
  runId,           // 'run_abc123'
  stepId,          // 'step_def456'
  'component.tsx', // filename
  content,         // generated code
  'text/typescript'
);
// Result: local_data/runs/run_abc123/steps/step_def456/component.tsx
```

##### Stage 2: Workspace Writing (Optional)
```typescript
// Copy artifact to project workspace
await workspaceWriter.run({
  sourceArtifact: artifactPath,
  targetPath: 'src/components/Button.tsx',
  projectId: 'p_myproject',
  commit: true,
  commitMessage: 'Add Button component'
});
// Result: Project workspace updated with new file
```

#### Storage Locations

| Content Type | Local Development | Production Cloud |
|--------------|------------------|------------------|
| Artifacts | `local_data/runs/{runId}/steps/{stepId}/` | Supabase Storage Bucket |
| Workspaces | `local_data/workspaces/{projectId}/` | Not applicable (local only) |
| Database | PostgreSQL or JSON files | Supabase PostgreSQL |
| Logs | `local_data/logs/` | Vercel Function logs |

### Git Integration

#### Three Git Modes for Progressive Disclosure

##### Hidden Mode (Default for Non-Technical Users)
```json
{
  "git_mode": "hidden",
  "operation": "save"
}
```
**User Sees**: "Save Progress" button
**System Does**:
- `git add .`
- `git commit -m "Updated My Store - 10/12/2024 10:30 AM"`
- No Git terminology exposed

##### Basic Mode (Learning Users)
```json
{
  "git_mode": "basic",
  "operation": "save",
  "message": "Added shopping cart"
}
```
**User Sees**: Simple version control concepts
**System Shows**:
- Commit messages
- Branch names (simplified)
- "Sync" instead of push/pull

##### Advanced Mode (Developers)
```json
{
  "git_mode": "advanced",
  "operation": "commit",
  "message": "feat(cart): implement Redux integration",
  "files": ["src/cart/*"],
  "options": {"--no-verify": true}
}
```
**User Sees**: Full Git control
**Available Operations**:
- Branch management
- Interactive rebase
- Cherry-pick
- Stash operations

#### Git Operations Flow

```typescript
class WorkspaceManager {
  // Auto-commit with mode-aware messaging
  async autoCommit(project: Project, message?: string) {
    const status = await git.status();
    if (status.isClean()) return;

    await git.add('.');

    const commitMsg = this.generateCommitMessage(
      project.git_mode,
      message
    );

    return await git.commit(commitMsg);
  }

  // Adaptive message generation
  generateCommitMessage(mode: string, msg?: string) {
    switch(mode) {
      case 'hidden':
        return `Updated ${project.name} - ${timestamp}`;
      case 'basic':
        return msg || `Update: ${timestamp}`;
      case 'advanced':
        return msg || `chore: auto-save at ${timestamp}`;
    }
  }
}
```

### Workflow Orchestration

#### Complete Run Execution Pipeline

```
1. Request Reception
   POST /runs → Parse prompt → Create plan

2. Run Initialization
   Generate run_id → Create step records → Set idempotency keys

3. Queue Processing
   Enqueue steps → Worker pulls → Check idempotency

4. Handler Execution
   Load handler → Execute with timeout → Handle errors

5. Artifact Generation
   Generate content → Save artifact → Update database

6. Workspace Operations
   Copy to workspace → Auto-commit → Optional PR

7. Completion
   Update status → Record events → Send notifications
```

#### Handler Pipeline Example

```typescript
// Complete workflow for adding authentication
const plan = {
  steps: [
    {
      name: "Design auth system",
      tool: "codegen",
      inputs: { prompt: "Design OAuth2 authentication" }
    },
    {
      name: "Generate auth code",
      tool: "codegen",
      inputs: { prompt: "Implement OAuth2 with Passport.js" }
    },
    {
      name: "Write to project",
      tool: "workspace:write",
      inputs: {
        fromStep: "Generate auth code",
        targetPath: "src/auth/oauth.ts",
        commit: true
      }
    },
    {
      name: "Run tests",
      tool: "gate:test",
      inputs: { testCommand: "npm test" }
    },
    {
      name: "Create PR",
      tool: "git_pr",
      inputs: {
        title: "feat: Add OAuth2 authentication",
        branch: "feature/oauth"
      }
    }
  ]
};
```

---

## API and Integration Points

### Core REST API Endpoints

#### Run Management
```typescript
// Create a new run
POST /runs
{
  "prompt": "Add user authentication",
  "project_id": "p_myproject"
}

// Get run status
GET /runs/{runId}
Response: {
  "id": "run_abc123",
  "status": "running",
  "steps": [...],
  "artifacts": [...]
}

// List runs
GET /runs?project_id=p_myproject&status=succeeded
```

#### Project Management
```typescript
// Create project
POST /projects
{
  "name": "E-commerce Platform",
  "workspace_mode": "clone",
  "repo_url": "https://github.com/user/ecommerce.git",
  "git_mode": "basic"
}

// Update project
PATCH /projects/{projectId}
{
  "git_mode": "advanced",
  "default_branch": "develop"
}
```

#### Real-Time Updates (Server-Sent Events)
```typescript
// Stream run events
GET /runs/{runId}/events
Response: SSE stream
data: {"event": "step.started", "step": "Generate auth code"}
data: {"event": "step.finished", "outputs": {...}}
```

### GitHub Integration

```typescript
// Pull Request Creation
async createPullRequest(project: Project, options: PROptions) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  return await octokit.pulls.create({
    owner: project.owner,
    repo: project.repo,
    title: options.title,
    head: options.branch,
    base: project.default_branch,
    body: options.description
  });
}
```

---

## Configuration and Deployment

### Environment Variables

#### Local Development (.env)
```bash
# Core Configuration
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/nofx

# Storage Drivers
DATA_DRIVER=fs        # or 'postgres'
QUEUE_DRIVER=memory   # or 'redis', 'postgres'

# Workspace Configuration
WORKSPACE_ROOT=/Users/dev/nofx-workspaces

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Git Integration
GITHUB_TOKEN=ghp_...
GIT_DEFAULT_BRANCH=main

# Security
ADMIN_PASSWORD=secure_password_here
JWT_SECRET=your_jwt_secret
```

#### Production (Vercel + Supabase)
```bash
# Vercel Environment Variables
NODE_ENV=production
VERCEL_ENV=production

# Supabase Configuration
DATABASE_URL=postgresql://[connection-string]
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-key]

# Storage & Queue
DATA_DRIVER=postgres
QUEUE_DRIVER=postgres
ARTIFACT_BUCKET=nofx-artifacts

# AI Providers (same as development)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Database Schema

```sql
-- Core tables
CREATE TABLE nofx.project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_url TEXT,
  local_path TEXT,
  workspace_mode TEXT DEFAULT 'local_path',
  git_mode TEXT DEFAULT 'hidden',
  default_branch TEXT DEFAULT 'main',
  initialized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nofx.run (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES nofx.project(id),
  status TEXT NOT NULL,
  plan JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nofx.step (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES nofx.run(id),
  name TEXT NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL,
  inputs JSONB,
  outputs JSONB,
  idempotency_key TEXT UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE TABLE nofx.artifact (
  id SERIAL PRIMARY KEY,
  step_id TEXT REFERENCES nofx.step(id),
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Deployment Steps

#### Local Development
```bash
# 1. Clone repository
git clone https://github.com/your-org/nofx-local-starter.git
cd nofx-local-starter

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
npm run migrate

# 5. Start services
npm run dev
```

#### Production (Vercel + Supabase)
```bash
# 1. Set up Supabase
- Create project at supabase.com
- Run migrations in SQL editor
- Create storage bucket 'nofx-artifacts'

# 2. Deploy to Vercel
vercel --prod

# 3. Configure environment
- Add all production env vars in Vercel dashboard
- Set up custom domain (optional)

# 4. Verify deployment
curl https://your-app.vercel.app/api/health
```

---

## Security and Best Practices

### Security Layers

#### 1. Workspace Isolation
```typescript
// Each project gets sandboxed workspace
const workspacePath = path.join(
  WORKSPACE_ROOT,    // /var/nofx/workspaces
  project.id          // /p_abc123 (sandboxed)
);

// Prevent directory traversal
if (!workspacePath.startsWith(WORKSPACE_ROOT)) {
  throw new Error('Invalid workspace path');
}
```

#### 2. Authentication & Authorization
```typescript
// Middleware for protected routes
export async function requireAuth(req: Request, res: Response, next: Next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### 3. Input Validation
```typescript
import { z } from 'zod';

const CreateRunSchema = z.object({
  prompt: z.string().min(1).max(10000),
  project_id: z.string().regex(/^p_[a-z0-9]+$/),
  model: z.enum(['gpt-4', 'claude-3', 'fast']).optional()
});

// Validate request
const validated = CreateRunSchema.parse(req.body);
```

#### 4. Secret Management
```typescript
// Never log sensitive data
log.info({
  projectId: project.id,
  // DON'T: token: process.env.GITHUB_TOKEN
  hasToken: !!process.env.GITHUB_TOKEN  // DO: boolean flag
}, 'Cloning repository');

// Mask secrets in outputs
function maskSecrets(text: string): string {
  return text.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***');
}
```

### Best Practices

#### Idempotency
```typescript
// Generate deterministic idempotency keys
function generateIdempotencyKey(runId: string, step: any): string {
  const data = `${runId}:${step.name}:${JSON.stringify(step.inputs)}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Check before execution
const existing = await store.getStepByIdempotencyKey(key);
if (existing) {
  log.info({ key }, 'Step already executed, skipping');
  return existing;
}
```

#### Error Handling
```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  // Log with context
  log.error({
    error: error.message,
    stack: error.stack,
    context: { runId, stepId, operation: 'riskyOperation' }
  }, 'Operation failed');

  // Record event for audit
  await recordEvent(runId, 'error.occurred', {
    error: error.message,
    step: stepId
  });

  // Return safe error to client
  return {
    success: false,
    error: 'Operation failed. See logs for details.'
  };
}
```

---

## Use Cases and Examples

### Use Case 1: Simple Content Generation

**Scenario**: Generate a blog post about AI

```typescript
// User request
POST /runs
{
  "prompt": "Write a blog post about the future of AI"
}

// System creates plan
{
  "steps": [{
    "tool": "codegen",
    "inputs": {
      "prompt": "Write a blog post about the future of AI",
      "filename": "ai-future-blog.md"
    }
  }]
}

// Result
Artifact saved: local_data/runs/run_123/steps/step_456/ai-future-blog.md
```

### Use Case 2: Full Application Feature

**Scenario**: Add shopping cart to e-commerce site

```typescript
// User request
POST /runs
{
  "prompt": "Add shopping cart functionality with checkout",
  "project_id": "p_ecommerce"
}

// System creates multi-step plan
{
  "steps": [
    {
      "name": "Design cart schema",
      "tool": "codegen",
      "inputs": { "prompt": "Design shopping cart database schema" }
    },
    {
      "name": "Create cart components",
      "tool": "codegen",
      "inputs": { "prompt": "Create React shopping cart components" }
    },
    {
      "name": "Write cart components",
      "tool": "workspace:write",
      "inputs": {
        "fromStep": "Create cart components",
        "targetPath": "src/components/Cart.tsx"
      }
    },
    {
      "name": "Create checkout flow",
      "tool": "codegen",
      "inputs": { "prompt": "Implement Stripe checkout integration" }
    },
    {
      "name": "Write checkout code",
      "tool": "workspace:write",
      "inputs": {
        "fromStep": "Create checkout flow",
        "targetPath": "src/checkout/stripe.ts"
      }
    },
    {
      "name": "Run tests",
      "tool": "gate:test",
      "inputs": { "testCommand": "npm test" }
    },
    {
      "name": "Create pull request",
      "tool": "git_pr",
      "inputs": {
        "title": "feat: Add shopping cart with Stripe checkout",
        "branch": "feature/shopping-cart"
      }
    }
  ]
}
```

### Use Case 3: Enterprise Deployment Pipeline

**Scenario**: Deploy microservice with approvals

```typescript
{
  "steps": [
    {
      "name": "Run unit tests",
      "tool": "gate:test",
      "inputs": { "testCommand": "npm test" }
    },
    {
      "name": "Security scan",
      "tool": "gate:security",
      "inputs": { "scanCommand": "npm audit" }
    },
    {
      "name": "Manual QA approval",
      "tool": "manual:approval",
      "inputs": {
        "approvers": ["qa-team@company.com"],
        "message": "Please review test results"
      }
    },
    {
      "name": "Deploy to staging",
      "tool": "deploy:kubernetes",
      "inputs": {
        "environment": "staging",
        "manifest": "k8s/staging.yaml"
      }
    },
    {
      "name": "Run smoke tests",
      "tool": "gate:smoke",
      "inputs": { "endpoint": "https://staging.api.com/health" }
    },
    {
      "name": "Production approval",
      "tool": "manual:approval",
      "inputs": {
        "approvers": ["cto@company.com"],
        "message": "Approve production deployment"
      }
    },
    {
      "name": "Deploy to production",
      "tool": "deploy:kubernetes",
      "inputs": {
        "environment": "production",
        "manifest": "k8s/production.yaml"
      }
    }
  ]
}
```

---

## Implementation Roadmap

### Current State (v1.0)

✅ **Core Features**
- Basic run orchestration
- Artifact storage system
- Git integration (clone, commit)
- Multiple handler types
- Queue processing
- Event streaming

⚠️ **Limitations**
- Manual GitHub connection
- Basic error recovery
- Limited monitoring
- No semantic search
- Single-tenant architecture

### Phase 1: Enhanced Git Integration (Q1 2025)

```typescript
// GitHub OAuth Integration
class GitHubAuthService {
  async connectRepository(userId: string, repoUrl: string) {
    const token = await this.getOAuthToken(userId);
    const repo = await this.validateAccess(token, repoUrl);
    await this.createWebhooks(repo);
    return repo;
  }
}

// Automated PR workflows
class PRAutomation {
  async handlePREvent(event: PREvent) {
    if (event.action === 'opened') {
      await this.runCIChecks(event.pr);
      await this.notifyReviewers(event.pr);
    }
  }
}
```

### Phase 2: AI Enhancement with ChromaDB (Q2 2025)

```typescript
// Semantic artifact search
class ChromaDBService {
  async indexArtifact(artifact: Artifact) {
    const embedding = await this.generateEmbedding(artifact.content);
    await this.chromaClient.add({
      ids: [artifact.id],
      embeddings: [embedding],
      metadatas: [{
        runId: artifact.runId,
        type: artifact.type,
        project: artifact.projectId
      }]
    });
  }

  async findSimilar(query: string, limit = 10) {
    const embedding = await this.generateEmbedding(query);
    return await this.chromaClient.query({
      queryEmbeddings: [embedding],
      nResults: limit
    });
  }
}

// Context-aware code generation
class EnhancedCodegen {
  async generate(prompt: string, projectId: string) {
    // Find relevant past artifacts
    const context = await chromaDB.findSimilar(prompt);

    // Enhance prompt with context
    const enhancedPrompt = `
      ${prompt}

      Relevant project context:
      ${context.map(c => c.document).join('\n')}
    `;

    return await this.aiModel.generate(enhancedPrompt);
  }
}
```

### Phase 3: Enterprise Features (Q3 2025)

- Multi-tenancy with organization support
- RBAC (Role-Based Access Control)
- Advanced deployment strategies (blue-green, canary)
- Custom handler marketplace
- Audit compliance reporting
- SLA monitoring and alerting

### Phase 4: Scale & Performance (Q4 2025)

- Distributed queue processing
- Horizontal scaling
- Global CDN for artifacts
- Real-time collaboration
- Advanced caching strategies
- Performance analytics dashboard

---

## Troubleshooting and Debugging

### Common Issues and Solutions

#### Issue: "Run stuck in pending"
```bash
# Check queue status
curl localhost:3000/dev/queue

# Check worker health
curl localhost:3000/dev/worker/health

# View queue jobs
redis-cli
> KEYS bull:*
> HGETALL "bull:step-ready:1"

# Solution: Restart worker
npm run worker:restart
```

#### Issue: "Workspace not found"
```bash
# Verify project configuration
curl localhost:3000/projects/p_abc123

# Check workspace directory
ls -la local_data/workspaces/

# Re-initialize workspace
curl -X POST localhost:3000/runs \
  -d '{"plan":{"steps":[{"tool":"project_init","inputs":{"project_id":"p_abc123"}}]}}'
```

#### Issue: "Git authentication failed"
```bash
# Check token is set
echo $GITHUB_TOKEN

# Test git access
git ls-remote https://${GITHUB_TOKEN}@github.com/user/repo.git

# Update project with token
export GITHUB_TOKEN=ghp_newtoken
npm run dev
```

### Debug Logging

```bash
# Enable verbose logging
DEBUG=nofx:* npm run dev

# Specific modules
DEBUG=nofx:workspace,nofx:git npm run dev

# View logs
tail -f local_data/logs/nofx.log

# Query structured logs
cat local_data/logs/nofx.log | jq 'select(.level=="error")'
```

### Monitoring Checklist

#### Health Checks
```typescript
// API health
GET /health
Response: {
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "available"
  }
}

// Worker health
GET /dev/worker/health
Response: {
  "status": "running",
  "jobs": {
    "active": 2,
    "waiting": 5,
    "completed": 150,
    "failed": 3
  }
}
```

#### Performance Metrics
```typescript
// Track handler execution time
const startTime = Date.now();
await handler.run(context);
const duration = Date.now() - startTime;

metrics.record('handler.duration', duration, {
  handler: handler.name,
  status: 'success'
});

// Monitor queue depth
const queueDepth = await queue.getWaitingCount();
if (queueDepth > 100) {
  alerts.send('Queue depth critical', { depth: queueDepth });
}
```

---

## Appendices

### Glossary

| Term | Definition |
|------|------------|
| **Artifact** | Generated file stored in the system |
| **Handler** | Executable component that performs specific tasks |
| **Run** | Complete execution workflow with multiple steps |
| **Step** | Individual unit of work within a run |
| **Workspace** | Isolated directory for project operations |
| **Worktree** | Git feature for multiple working directories |
| **Idempotency Key** | Unique identifier preventing duplicate execution |
| **Gate** | Quality check or approval step |
| **Plan** | Structured definition of steps to execute |

### Code Examples

#### Creating a Custom Handler
```typescript
// src/worker/handlers/myhandler.ts
import { StepHandler } from './types';

export const handler: StepHandler = {
  match: (tool: string) => tool === 'my:handler',

  async run(context) {
    const { runId, step, store } = context;

    try {
      // Update status
      await store.updateStep(step.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      // Perform work
      const result = await doWork(step.inputs);

      // Save artifact if needed
      const artifact = await saveArtifact(
        runId,
        step.id,
        'output.json',
        JSON.stringify(result)
      );

      // Update completion
      await store.updateStep(step.id, {
        status: 'succeeded',
        outputs: { artifact },
        ended_at: new Date().toISOString()
      });

    } catch (error) {
      await store.updateStep(step.id, {
        status: 'failed',
        outputs: { error: error.message },
        ended_at: new Date().toISOString()
      });
      throw error;
    }
  }
};

export default handler;
```

#### API Client Example
```typescript
// TypeScript client for NOFX API
class NOFXClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  async createRun(prompt: string, projectId?: string) {
    const response = await fetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, project_id: projectId })
    });

    return response.json();
  }

  async streamEvents(runId: string) {
    const eventSource = new EventSource(
      `${this.baseUrl}/runs/${runId}/events`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Event:', data);
    };

    return eventSource;
  }
}

// Usage
const client = new NOFXClient('sk_...', 'https://api.nofx.com');
const run = await client.createRun('Add authentication');
const events = await client.streamEvents(run.id);
```

### Configuration Templates

#### Docker Compose (Local Development)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: nofx
      POSTGRES_USER: nofx
      POSTGRES_PASSWORD: nofx
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://nofx:nofx@postgres:5432/nofx
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./local_data:/app/local_data
      - ./workspaces:/app/workspaces

volumes:
  postgres_data:
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nofx-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nofx-api
  template:
    metadata:
      labels:
        app: nofx-api
    spec:
      containers:
      - name: api
        image: nofx/control-plane:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: nofx-secrets
              key: database-url
        - name: NODE_ENV
          value: production
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: nofx-api
spec:
  selector:
    app: nofx-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

---

## Summary

The NOFX Control Plane provides a sophisticated yet user-friendly system for handling GitHub repositories and file changes through:

1. **Isolated Workspaces** - Safe experimentation without repository damage
2. **Two-Stage Artifacts** - Generate first, deploy second philosophy
3. **Progressive Git Disclosure** - Complexity that scales with user expertise
4. **Complete Orchestration** - End-to-end workflow management
5. **Enterprise Ready** - Security, audit trails, and scalability built-in

The system achieves the delicate balance of being powerful enough for developers while remaining approachable for non-technical entrepreneurs, making it a unique solution in the code generation and repository management space.

For the latest updates and detailed API documentation, visit the [NOFX Documentation](https://docs.nofx.com) or check the [GitHub repository](https://github.com/nofx/control-plane).