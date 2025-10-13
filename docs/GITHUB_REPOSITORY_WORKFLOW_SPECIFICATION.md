# NOFX Control Plane: GitHub Repository & File Change Management Specification

**Version:** 1.0
**Last Updated:** 2025-10-12
**Status:** Comprehensive Technical Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Complete Workflow: User Request to GitHub](#complete-workflow-user-request-to-github)
4. [Core Components Deep Dive](#core-components-deep-dive)
5. [Data Flow & File Management](#data-flow--file-management)
6. [Git Integration Patterns](#git-integration-patterns)
7. [API Endpoints & Contracts](#api-endpoints--contracts)
8. [Security & Isolation](#security--isolation)
9. [Configuration & Deployment](#configuration--deployment)
10. [Task Decomposition for Development](#task-decomposition-for-development)

---

## 1. Executive Summary

### System Purpose
The NOFX Control Plane orchestrates AI-powered code generation and project modifications through a secure, auditable workflow system. It does NOT directly modify GitHub repositories but uses isolated workspaces and a two-stage artifact system.

### Key Characteristics
- **Artifact-Based Architecture**: Changes flow through artifacts before reaching workspaces
- **Workspace Isolation**: Three modes (local_path, clone, worktree) for different use cases
- **Adaptive Git Operations**: UI complexity adapts to user skill level (hidden/basic/advanced)
- **Exactly-Once Semantics**: Idempotency keys ensure operations execute once
- **Cloud-Native**: Fully deployed on Vercel + Supabase (no local services required)

### ChromaDB Integration Opportunities
1. **Artifact Search & Retrieval**: Store artifact metadata and content for semantic search
2. **Code Knowledge Base**: Index generated code for context-aware follow-up operations
3. **Run History Analysis**: Store run patterns for intelligent workflow suggestions
4. **Project Context**: Maintain project-specific context for better AI generation

---

## 2. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│                    (Natural Language Prompt)                     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER (Vercel)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Plan Builder │─▶│  Run Manager │─▶│ Step Orchestrator    │  │
│  │ (Translate)  │  │  (Create)    │  │ (Queue & Track)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     QUEUE SYSTEM (PostgreSQL)                    │
│              Messages: {runId, stepId, idempotencyKey}           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WORKER/RUNNER (Vercel Function)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    STEP EXECUTION                         │  │
│  │  1. Idempotency Check  → 2. Dependency Validation         │  │
│  │  3. Policy Enforcement → 4. Handler Selection             │  │
│  │  5. Tool Execution     → 6. Result Persistence            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                    ┌────────────────┐
                    │    HANDLERS    │
                    └────────┬───────┘
                             ▼
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│  CODEGEN HANDLER │                   │ WORKSPACE HANDLER│
│  (Generate Code) │                   │  (Copy & Commit) │
└────────┬─────────┘                   └────────┬─────────┘
         ▼                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  ARTIFACT STORAGE (Supabase)                  │
│     Path: runs/{runId}/steps/{stepId}/{filename}             │
│     Metadata: driver, sha256, content_type                   │
└────────────────────────────┬─────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               WORKSPACE MANAGEMENT (Local/Clone/Worktree)        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Local Path   │  │ Clone Repo   │  │ Worktree (Isolated)  │  │
│  │ (Existing)   │  │ (Fresh Copy) │  │ (Branch Sandbox)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GIT OPERATIONS (simple-git)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auto Commit  │  │ Branch Mgmt  │  │ PR Creation (GitHub) │  │
│  │ (Hidden)     │  │ (Basic)      │  │ (Advanced)           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                    ┌────────────────┐
                    │ GITHUB REMOTE  │
                    │  (Push/PR)     │
                    └────────────────┘
```

### Component Layers

1. **API Layer** (`src/api/`)
   - Express server with modular route loading
   - Plan building (natural language → structured plan)
   - Run creation and orchestration
   - SSE streaming for real-time updates

2. **Queue Layer** (`src/lib/queue/`)
   - Driver abstraction (Memory, Redis, PostgreSQL)
   - Exactly-once delivery with idempotency
   - Backpressure handling for large plans
   - Dead letter queue (DLQ) for failed jobs

3. **Worker Layer** (`src/worker/`)
   - Step execution engine with timeout handling
   - Dynamic handler loading
   - Policy enforcement (tools, env, secrets)
   - Dependency resolution (DAG)

4. **Storage Layer** (`src/lib/store/`)
   - Database abstraction (PostgreSQL/Filesystem)
   - Run, Step, Event, Artifact persistence
   - Inbox/Outbox patterns for consistency

5. **Workspace Layer** (`src/lib/workspaces.ts`)
   - Git repository management
   - Workspace isolation strategies
   - Auto-commit with configurable messages

6. **Integration Layer** (`src/worker/handlers/`)
   - Pluggable tool handlers
   - Git operations (hidden/basic/advanced modes)
   - External service integrations

---

## 3. Complete Workflow: User Request to GitHub

### 3.1 Phase 1: Request Reception & Planning

**Input:** User submits natural language prompt
```json
{
  "standard": {
    "prompt": "Create a React component for user authentication",
    "quality": true,
    "openPr": true,
    "filePath": "src/components/Auth.tsx",
    "projectId": "my-project"
  }
}
```

**Process:**
1. **API Endpoint:** `POST /runs` receives request
2. **Plan Builder:** (`src/api/planBuilder.ts`) translates prompt into structured plan
3. **Validation:** Zod schema validates plan structure
4. **Plan Output:**
```json
{
  "goal": "Create React authentication component",
  "steps": [
    {
      "name": "generate_code",
      "tool": "codegen",
      "inputs": {
        "prompt": "Create a React component for user authentication",
        "filename": "Auth.tsx",
        "model": "claude-sonnet-4"
      }
    },
    {
      "name": "write_to_workspace",
      "tool": "workspace:write",
      "inputs": {
        "projectId": "my-project",
        "targetPath": "src/components/Auth.tsx",
        "fromStep": "generate_code",
        "artifactName": "Auth.tsx",
        "commit": true,
        "commitMessage": "feat: add authentication component"
      }
    },
    {
      "name": "run_tests",
      "tool": "gate:test",
      "inputs": {
        "command": "npm test -- Auth.test.tsx"
      }
    },
    {
      "name": "create_pr",
      "tool": "git_pr",
      "inputs": {
        "projectId": "my-project",
        "title": "Add authentication component",
        "branch": "feature/auth-component"
      }
    }
  ]
}
```

### 3.2 Phase 2: Run & Step Creation

**Process:**
1. **Run Creation:** Store creates run record in database
```typescript
const run = await store.createRun({
  ...plan,
  user_id: req.userId,
  metadata: { created_by: req.userId, tier: req.userTier }
}, projectId);
```

2. **Step Preparation:** Each step gets:
   - Idempotency key: `{runId}:{stepName}:{hash(inputs)}`
   - Policy metadata (tools_allowed, env_allowed, secrets_scope)
   - Status: 'pending'

3. **Batch Step Creation:** All steps created in parallel
```typescript
const creationResults = await Promise.allSettled(
  stepPreparations.map(({ step, idemKey, inputsWithPolicy }) =>
    store.createStep(runId, step.name, step.tool, inputsWithPolicy, idemKey)
  )
);
```

4. **Event Recording:** `run.created`, `step.enqueued` events logged

### 3.3 Phase 3: Queue & Execution

**Queueing:**
1. **Backpressure Check:** Delays enqueue if queue age > threshold
2. **Message Structure:**
```json
{
  "runId": "run_abc123",
  "stepId": "step_xyz789",
  "idempotencyKey": "run_abc123:generate_code:a1b2c3d4"
}
```

3. **Enqueue:** Message sent to `STEP_READY_TOPIC`

**Worker Execution:**
1. **Dequeue:** Worker pulls message from queue
2. **Idempotency Guard:** Check inbox for duplicate execution
3. **Dependency Validation:** Verify `_dependsOn` steps completed
4. **Policy Enforcement:** Validate tools_allowed, env_allowed
5. **Handler Selection:** Match tool name to handler
6. **Tool Execution:** Handler runs with timeout protection
7. **Result Persistence:** Update step status, outputs, artifacts
8. **Event Recording:** `step.started`, `step.finished`, `step.failed`

### 3.4 Phase 4: Code Generation (codegen handler)

**Handler:** `src/worker/handlers/codegen.ts`

**Process:**
1. **Model Selection:** Choose AI model (legacy router or Agent SDK)
2. **Prompt Execution:**
```typescript
const result = await codegenReadme({
  prompt: inputs.prompt,
  model: inputs.model || 'claude-sonnet-4',
  temperature: inputs.temperature || 0.7
});
```

3. **Artifact Storage:**
```typescript
const artifactPath = await saveArtifact(
  runId,
  stepId,
  'Auth.tsx',
  result.content,
  'text/plain'
);
// Path: runs/{runId}/steps/{stepId}/Auth.tsx
```

4. **Supabase Upload:** Tries cloud storage first, falls back to local filesystem
5. **Metadata Recording:**
```json
{
  "artifact": "runs/.../Auth.tsx",
  "provider": "anthropic",
  "model": "claude-sonnet-4",
  "usage": { "totalTokens": 1500 },
  "costUSD": 0.0225,
  "driver": "supabase",
  "sha256": "a1b2c3d4..."
}
```

### 3.5 Phase 5: Workspace Write

**Handler:** `src/worker/handlers/workspace_write.ts`

**Process:**
1. **Artifact Resolution:**
   - Look up previous step by name (`fromStep`)
   - Find artifact by name in step's artifacts
   - Construct source path: `local_data/runs/{runId}/steps/{stepId}/Auth.tsx`

2. **Project Lookup:**
```typescript
const project = await getProject(projectId);
// Returns: { id, name, repo_url, workspace_mode, git_mode, ... }
```

3. **Workspace Resolution:**
```typescript
const workspaceManager = new WorkspaceManager();
const workspacePath = await workspaceManager.ensureWorkspace(project);
```

**Workspace Modes:**
- **local_path:** Uses `project.local_path` directly
- **clone:** `local_data/workspaces/{project.id}` (cloned repo)
- **worktree:** `local_data/workspaces/{project.id}` (git worktree)

4. **File Write:**
```typescript
const targetFullPath = path.join(workspacePath, 'src/components/Auth.tsx');
await fs.mkdir(path.dirname(targetFullPath), { recursive: true });
await fs.writeFile(targetFullPath, content, 'utf-8');
```

5. **Git Commit (if enabled):**
```typescript
if (inputs.commit) {
  const git = simpleGit(workspacePath);
  await git.add('src/components/Auth.tsx');
  await git.commit('feat: add authentication component');
}
```

### 3.6 Phase 6: Git Operations

**Handler:** `src/worker/handlers/git_ops.ts`

**Adaptive Operations Based on git_mode:**

**Hidden Mode** (Business users):
- Auto-commit with business-friendly messages
- No branch management shown
- Operations: `commit`, `sync`

**Basic Mode** (Developers):
- Simple git operations
- Branch creation/switching
- Operations: `commit`, `branch`, `merge`, `push`

**Advanced Mode** (Git experts):
- Full git control
- Rebase, cherry-pick, stash
- Operations: All git commands

**Example: Create Branch & Push**
```typescript
// Inputs
{
  "operation": "branch",
  "project_id": "my-project",
  "branch_name": "feature/auth-component"
}

// Execution
const git = simpleGit(workspacePath);
await git.checkoutLocalBranch('feature/auth-component');
await git.push('origin', 'feature/auth-component', ['--set-upstream']);
```

### 3.7 Phase 7: Pull Request Creation

**Handler:** `src/worker/handlers/git_pr.ts`

**Process:**
1. **Prerequisites:**
   - Branch exists with commits
   - GitHub token available
   - Repository is on GitHub

2. **PR Creation:**
```typescript
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

await octokit.pulls.create({
  owner: repoOwner,
  repo: repoName,
  title: "Add authentication component",
  head: "feature/auth-component",
  base: "main",
  body: "Generated by NOFX Control Plane\n\nAdds React authentication component"
});
```

3. **Output:**
```json
{
  "pr_url": "https://github.com/owner/repo/pull/123",
  "pr_number": 123,
  "branch": "feature/auth-component"
}
```

### 3.8 Phase 8: Completion & Notification

**Run Completion:**
1. **Step Status Check:** Worker checks remaining steps after each completion
2. **Run Closure:** When all steps succeeded/cancelled:
```typescript
await store.updateRun(runId, {
  status: 'succeeded',
  ended_at: new Date().toISOString()
});
await recordEvent(runId, 'run.succeeded', {});
```

3. **Event Stream:** SSE clients receive real-time updates
4. **Webhook Delivery:** Outbox relay sends webhooks to configured endpoints

---

## 4. Core Components Deep Dive

### 4.1 Workspace Manager (`src/lib/workspaces.ts`)

**Responsibilities:**
- Workspace path resolution
- Repository initialization/cloning
- Git operations (commit, sync, status)
- Workspace cleanup

**Key Methods:**

```typescript
class WorkspaceManager {
  // Resolve workspace path based on mode
  getWorkspacePath(project: Project): string {
    if (project.workspace_mode === 'local_path') {
      return project.local_path;
    }
    return path.join(WORKSPACE_ROOT, project.id);
  }

  // Initialize or ensure workspace exists
  async ensureWorkspace(project: Project): Promise<string> {
    const workspacePath = this.getWorkspacePath(project);

    if (project.initialized && await this.isGitRepo(workspacePath)) {
      if (project.repo_url) await this.syncWorkspace(project);
      return workspacePath;
    }

    if (project.repo_url) {
      await this.cloneRepo(project);
    } else {
      await this.initializeRepo(project);
    }

    return workspacePath;
  }

  // Clone repository with authentication
  async cloneRepo(project: Project): Promise<void> {
    const authUrl = this.addAuthToUrl(project.repo_url);
    await this.git.clone(authUrl, project.id, ['--depth', '1']);
  }

  // Auto-commit with mode-appropriate message
  async autoCommit(project: Project, message?: string): Promise<string> {
    const status = await this.git.status();
    if (status.isClean()) return '';

    await this.git.add('.');
    const commitMessage = message || this.generateCommitMessage(project, 'Save progress');
    const commit = await this.git.commit(commitMessage);

    return commit.commit;
  }
}
```

**Workspace Modes:**

| Mode | Use Case | Path | Git Init |
|------|----------|------|----------|
| `local_path` | Existing local project | `project.local_path` | No |
| `clone` | Fresh repo copy | `local_data/workspaces/{id}` | Clone |
| `worktree` | Isolated branch work | `local_data/workspaces/{id}` | Worktree |

### 4.2 Artifact System (`src/lib/artifacts.ts`)

**Two-Stage Process:**
1. Generate → Save as artifact
2. Copy artifact → Workspace

**Storage Strategy:**
```typescript
async function saveArtifact(
  runId: string,
  stepId: string,
  artifactName: string,
  content: string,
  contentType = 'text/plain'
) {
  const rel = `runs/${runId}/steps/${stepId}/${artifactName}`;

  // Try Supabase Storage (cloud-first)
  try {
    const bucket = supabase.storage.from(ARTIFACT_BUCKET);
    const body = Buffer.from(content, 'utf8');
    await bucket.upload(rel, body, { upsert: true, contentType });

    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    await store.addArtifact(stepId, contentType, rel, {
      driver: 'supabase',
      sha256
    });

    return rel;
  } catch (err) {
    // Fallback to local filesystem
    const full = path.join(process.cwd(), 'local_data', rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');

    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    await store.addArtifact(stepId, contentType, rel, {
      driver: 'fs-fallback',
      sha256
    });

    return rel;
  }
}
```

**Artifact Metadata:**
```typescript
interface Artifact {
  id: string;
  run_id: string;
  step_id: string;
  type: string;           // 'file', 'code', 'doc', 'image'
  path: string;           // 'runs/{runId}/steps/{stepId}/{name}'
  metadata: {
    driver: string;       // 'supabase' | 'fs-fallback'
    sha256: string;       // Content hash for integrity
    content_type?: string;
    size?: number;
  };
  created_at: string;
}
```

### 4.3 Project Configuration (`src/lib/projects.ts`)

**Project Schema:**
```typescript
interface Project {
  id: string;                    // 'p_abc123' or 'default'
  name: string;                  // Display name
  repo_url?: string | null;      // GitHub repo URL
  local_path?: string | null;    // For local_path mode
  workspace_mode?: 'local_path' | 'clone' | 'worktree';
  default_branch?: string;       // 'main', 'master', etc.
  git_mode?: 'hidden' | 'basic' | 'advanced';
  initialized?: boolean;         // Workspace setup complete
}
```

**Configuration Examples:**

**Existing Local Project:**
```json
{
  "id": "local-react",
  "name": "My React App",
  "local_path": "/Users/dev/my-react-app",
  "workspace_mode": "local_path",
  "git_mode": "advanced",
  "initialized": true
}
```

**Clone Remote Repo:**
```json
{
  "id": "clone-backend",
  "name": "Backend API",
  "repo_url": "https://github.com/org/backend-api",
  "workspace_mode": "clone",
  "git_mode": "basic",
  "default_branch": "develop"
}
```

**Worktree Isolation:**
```json
{
  "id": "worktree-feature",
  "name": "Feature Branch Work",
  "repo_url": "https://github.com/org/main-app",
  "workspace_mode": "worktree",
  "git_mode": "advanced"
}
```

### 4.4 Step Execution Engine (`src/worker/runner.ts`)

**Execution Flow:**
```typescript
async function runStep(runId: string, stepId: string) {
  // 1. Load step from store
  const step = await store.getStep(stepId);

  // 2. Exactly-once guard (inbox pattern)
  const executionKey = `step-exec:${stepId}`;
  const ok = await store.inboxMarkIfNew(executionKey);
  if (!ok) {
    log.warn('Duplicate execution prevented');
    return;
  }

  // 3. Dependency check (_dependsOn)
  const deps = step.inputs._dependsOn || [];
  if (deps.length > 0) {
    const steps = await store.listStepsByRun(runId);
    const allDepsReady = deps.every(name => {
      const depStep = steps.find(s => s.name === name);
      return ['succeeded', 'cancelled'].includes(depStep?.status);
    });

    if (!allDepsReady) {
      await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: 2000 });
      return;
    }
  }

  // 4. Policy enforcement (tools_allowed)
  const policy = step.inputs._policy || {};
  if (policy.tools_allowed?.length > 0) {
    if (!policy.tools_allowed.includes(step.tool)) {
      await store.updateStep(stepId, {
        status: 'failed',
        outputs: { error: 'Tool not allowed by policy' }
      });
      return;
    }
  }

  // 5. Handler execution
  const handler = handlers.find(h => h.match(step.tool));
  await handler.run({ runId, step });

  // 6. Run completion check
  const remaining = await store.countRemainingSteps(runId);
  if (remaining === 0) {
    await store.updateRun(runId, { status: 'succeeded' });
    await recordEvent(runId, 'run.succeeded', {});
  }
}
```

**Idempotency Mechanism:**
```typescript
// Idempotency key generation
const hash = crypto
  .createHash('sha256')
  .update(JSON.stringify(step.inputs))
  .digest('hex')
  .slice(0, 12);

const idemKey = `${runId}:${step.name}:${hash}`;

// Inbox pattern for exactly-once execution
await store.inboxMarkIfNew(`step-exec:${stepId}`);
```

### 4.5 Queue System (`src/lib/queue/`)

**Driver Abstraction:**
```typescript
interface QueueImplementation {
  enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void>;
  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void;
  getCounts(topic: string): Promise<unknown>;
  hasSubscribers?(topic: string): boolean;
  getOldestAgeMs?(topic: string): number | null;
}
```

**Available Drivers:**

1. **Memory (Development):**
   - In-process queue
   - No persistence
   - Immediate execution fallback

2. **PostgreSQL (Production):**
   - Database-backed queue
   - Survives restarts
   - Supports delays, retries

3. **Redis (Optional):**
   - BullMQ integration
   - High throughput
   - Distributed workers

**Backpressure Handling:**
```typescript
async function enqueueStepWithBackpressure(
  runId: string,
  stepId: string,
  idemKey: string
) {
  const thresholdMs = Number(process.env.BACKPRESSURE_AGE_MS || 5000);
  const ageMs = getOldestAgeMs(STEP_READY_TOPIC);

  let delayMs = 0;
  if (ageMs > thresholdMs) {
    delayMs = Math.min((ageMs - thresholdMs) / 2, 15000);
    await recordEvent(runId, 'queue.backpressure', { ageMs, delayMs });
  }

  await enqueue(
    STEP_READY_TOPIC,
    { runId, stepId, idempotencyKey: idemKey },
    delayMs ? { delay: delayMs } : undefined
  );
}
```

---

## 5. Data Flow & File Management

### 5.1 File Flow Diagram

```
USER PROMPT
    │
    ▼
┌───────────────────┐
│   Plan Builder    │
│  (Natural Lang)   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Structured Plan  │
│  (Goal + Steps)   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│    Run Created    │
│   (PostgreSQL)    │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Steps Enqueued   │
│  (Queue System)   │
└─────────┬─────────┘
          ▼
┌───────────────────────────────────────┐
│          STEP: codegen                │
│                                       │
│  1. AI Model Call (Anthropic/OpenAI) │
│  2. Generate Code Content            │
│  3. Save to Artifact Storage         │
│     Path: runs/{runId}/steps/{id}/   │
│           {filename}                 │
│                                       │
│  Storage Priority:                   │
│  - Supabase Storage (cloud)          │
│  - Fallback: local_data/             │
└─────────┬─────────────────────────────┘
          ▼
┌───────────────────────────────────────┐
│     ARTIFACT METADATA RECORDED        │
│                                       │
│  {                                    │
│    artifact: "runs/.../file.tsx",    │
│    driver: "supabase",               │
│    sha256: "a1b2c3...",              │
│    content_type: "text/plain"        │
│  }                                    │
└─────────┬─────────────────────────────┘
          ▼
┌───────────────────────────────────────┐
│      STEP: workspace:write            │
│                                       │
│  1. Lookup Artifact from Previous     │
│  2. Read Content from Storage         │
│  3. Resolve Project Workspace         │
│  4. Write to Target Path              │
│     Example: {workspace}/src/Auth.tsx │
│  5. Optional: Git Commit              │
└─────────┬─────────────────────────────┘
          ▼
┌───────────────────────────────────────┐
│       FILE IN WORKSPACE               │
│                                       │
│  Location:                            │
│  - local_path: {local_path}/file     │
│  - clone: workspaces/{id}/file       │
│  - worktree: workspaces/{id}/file    │
│                                       │
│  Status: Committed (if enabled)       │
└─────────┬─────────────────────────────┘
          ▼
┌───────────────────────────────────────┐
│         STEP: git_ops                 │
│                                       │
│  1. Branch Creation/Switch            │
│  2. Push to Remote (if configured)    │
└─────────┬─────────────────────────────┘
          ▼
┌───────────────────────────────────────┐
│         STEP: git_pr                  │
│                                       │
│  1. GitHub API: Create PR             │
│  2. Link Branch to Base               │
│  3. Return PR URL                     │
└─────────┬─────────────────────────────┘
          ▼
    GITHUB PULL REQUEST
        (Ready for Review)
```

### 5.2 Storage Locations

**Artifact Storage:**
```
Cloud (Supabase Storage):
  Bucket: nofx-artifacts
  Path: runs/{runId}/steps/{stepId}/{filename}
  Access: Private, signed URLs for retrieval

Local Fallback:
  Root: {PROJECT_ROOT}/local_data/
  Path: runs/{runId}/steps/{stepId}/{filename}
  Access: Direct filesystem read
```

**Workspace Storage:**
```
local_path mode:
  {project.local_path}/
  Example: /Users/dev/my-app/src/components/Auth.tsx

clone mode:
  {WORKSPACE_ROOT}/{project.id}/
  Example: /local_data/workspaces/p_abc123/src/components/Auth.tsx

worktree mode:
  {WORKSPACE_ROOT}/{project.id}/
  Example: /local_data/workspaces/p_abc123/src/components/Auth.tsx
```

**Database Storage (PostgreSQL/Supabase):**
```sql
-- Runs
nofx.run (id, goal, plan, status, created_at, ended_at, project_id)

-- Steps
nofx.step (id, run_id, name, tool, inputs, outputs, status, idempotency_key, started_at, ended_at)

-- Events (Audit Trail)
nofx.event (id, run_id, step_id, type, payload, created_at)

-- Artifacts (Metadata Only)
nofx.artifact (id, run_id, step_id, type, path, metadata, created_at)

-- Projects
nofx.project (id, name, repo_url, local_path, workspace_mode, git_mode, initialized, created_at)
```

### 5.3 File Persistence Strategy

**Artifact Phase (Temporary):**
- **Purpose:** Store generated content before workspace write
- **Lifetime:** Retained for audit/rollback
- **Cleanup:** Optional, based on retention policy

**Workspace Phase (Permanent):**
- **Purpose:** Actual project files
- **Lifetime:** Managed by user/project
- **Cleanup:** Manual or via workspace cleanup

**Integrity Checks:**
```typescript
// SHA256 verification
const expectedHash = artifact.metadata.sha256;
const actualHash = crypto.createHash('sha256').update(content).digest('hex');

if (expectedHash !== actualHash) {
  throw new Error('Artifact integrity check failed');
}
```

---

## 6. Git Integration Patterns

### 6.1 Git Mode Comparison

| Feature | Hidden | Basic | Advanced |
|---------|--------|-------|----------|
| **Target User** | Business users | Developers | Git experts |
| **Commit Messages** | Business-friendly | Simple technical | Standard git format |
| **Branch Management** | Auto | Basic create/switch | Full control |
| **Operations** | commit, sync | + branch, merge, push | + rebase, stash, cherry-pick |
| **UI Complexity** | Minimal | Moderate | Full |
| **Error Handling** | Silent fallback | User-friendly | Technical details |

### 6.2 Commit Message Generation

```typescript
private generateCommitMessage(project: Project, defaultMessage: string): string {
  const timestamp = new Date().toLocaleString();

  switch (project.git_mode) {
    case 'hidden':
      // Business-friendly, no jargon
      return `Updated ${project.name} - ${timestamp}`;

    case 'basic':
      // Simple technical
      return defaultMessage || `Update: ${timestamp}`;

    case 'advanced':
      // Conventional commits
      return defaultMessage || `chore: auto-save at ${timestamp}`;
  }
}
```

### 6.3 Git Operations by Mode

**Hidden Mode:**
```typescript
class HiddenModeService {
  async executeOperation(git: SimpleGit, inputs: any, project: Project) {
    switch (inputs.operation) {
      case 'commit':
        // Auto-commit with friendly message
        await git.add('.');
        await git.commit(`Updated ${project.name} - ${new Date().toLocaleString()}`);
        return { committed: true };

      case 'sync':
        // Pull latest changes quietly
        await git.pull();
        return { synced: true };

      default:
        throw new Error('Operation not available in hidden mode');
    }
  }
}
```

**Basic Mode:**
```typescript
class BasicModeService {
  async executeOperation(git: SimpleGit, inputs: any, project: Project) {
    switch (inputs.operation) {
      case 'branch':
        const branchName = inputs.branch_name;
        await git.checkoutLocalBranch(branchName);
        return { branch: branchName, created: true };

      case 'merge':
        const sourceBranch = inputs.source_branch;
        await git.merge([sourceBranch]);
        return { merged: sourceBranch };

      case 'push':
        const branch = await git.branch();
        await git.push('origin', branch.current);
        return { pushed: branch.current };

      // Delegates to AdvancedModeService for complex ops
      default:
        return this.advancedModeService.executeOperation(git, inputs, project);
    }
  }
}
```

**Advanced Mode:**
```typescript
class AdvancedModeService {
  async executeOperation(git: SimpleGit, inputs: any, project: Project) {
    switch (inputs.operation) {
      case 'rebase':
        await git.rebase([inputs.onto_branch]);
        return { rebased: inputs.onto_branch };

      case 'cherry-pick':
        await git.raw(['cherry-pick', inputs.commit_sha]);
        return { cherryPicked: inputs.commit_sha };

      case 'stash':
        await git.stash(['save', inputs.message || 'Auto-stash']);
        return { stashed: true };

      case 'reset':
        await git.reset([inputs.mode || 'mixed', inputs.commit || 'HEAD']);
        return { reset: inputs.commit || 'HEAD' };

      // Full git command suite available
    }
  }
}
```

### 6.4 Authentication Handling

```typescript
private addAuthToUrl(url: string): string {
  const token = process.env.GITHUB_TOKEN || process.env.GIT_TOKEN;

  if (!token) return url;

  // HTTPS only
  if (url.startsWith('https://')) {
    return url.replace('https://', `https://${token}@`);
  }

  return url;
}
```

**Environment Variables:**
- `GITHUB_TOKEN`: Personal access token for GitHub
- `GIT_TOKEN`: Generic git token (GitLab, Bitbucket)

### 6.5 Pull Request Creation

**Handler:** `src/worker/handlers/git_pr.ts`

```typescript
import { Octokit } from '@octokit/rest';

async function createPullRequest(inputs: any, project: Project) {
  // Parse repo URL
  const match = project.repo_url.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (!match) throw new Error('Invalid GitHub URL');

  const [, owner, repo] = match;

  // Create PR
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const response = await octokit.pulls.create({
    owner,
    repo,
    title: inputs.title,
    head: inputs.branch,
    base: inputs.base || project.default_branch || 'main',
    body: inputs.body || `Generated by NOFX Control Plane\n\nRun ID: ${runId}`
  });

  return {
    pr_url: response.data.html_url,
    pr_number: response.data.number,
    branch: inputs.branch,
    base: response.data.base.ref
  };
}
```

---

## 7. API Endpoints & Contracts

### 7.1 Core Run Endpoints

**Create Run**
```http
POST /runs
Content-Type: application/json

{
  "standard": {
    "prompt": "Create authentication component",
    "quality": true,
    "openPr": true,
    "filePath": "src/Auth.tsx",
    "projectId": "my-project"
  }
}

Response: 201 Created
{
  "id": "run_abc123",
  "status": "queued",
  "projectId": "my-project"
}
```

**Get Run Status**
```http
GET /runs/{runId}

Response: 200 OK
{
  "id": "run_abc123",
  "goal": "Create authentication component",
  "status": "running",
  "plan": { ... },
  "created_at": "2025-10-12T10:00:00Z",
  "project_id": "my-project"
}
```

**List Runs**
```http
GET /runs?page=1&limit=20

Response: 200 OK
{
  "runs": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

**Stream Run Events**
```http
GET /runs/{runId}/stream
Accept: text/event-stream

Response: 200 OK (SSE)
data: {"type":"connected","runId":"run_abc123"}

data: {"type":"step.started","stepId":"step_xyz","tool":"codegen"}

data: {"type":"step.finished","stepId":"step_xyz","outputs":{...}}
```

**Retry Failed Step**
```http
POST /runs/{runId}/steps/{stepId}/retry

Response: 200 OK
{
  "success": true,
  "message": "Step retry initiated"
}
```

### 7.2 Artifact Endpoints

**Get Artifact**
```http
GET /artifacts/runs/{runId}/steps/{stepId}/{filename}

Response: 200 OK
Content-Type: text/plain
{artifact content}
```

### 7.3 Project Endpoints

**List Projects**
```http
GET /projects

Response: 200 OK
[
  {
    "id": "my-project",
    "name": "My Project",
    "repo_url": "https://github.com/org/repo",
    "workspace_mode": "clone",
    "git_mode": "basic",
    "initialized": true
  }
]
```

**Create Project**
```http
POST /projects
Content-Type: application/json

{
  "name": "New Project",
  "repo_url": "https://github.com/org/new-repo",
  "workspace_mode": "clone",
  "git_mode": "basic"
}

Response: 201 Created
{
  "id": "p_xyz789",
  "name": "New Project",
  ...
}
```

### 7.4 Data Contracts

**Plan Schema:**
```typescript
interface Plan {
  goal: string;
  steps: Array<{
    name: string;
    tool: string;
    inputs?: Record<string, any>;
    tools_allowed?: string[];
    env_allowed?: string[];
    secrets_scope?: string;
  }>;
}
```

**Step Input Schema:**
```typescript
interface StepInput {
  name: string;                    // Unique within run
  tool: string;                    // Handler identifier
  inputs?: {
    [key: string]: any;
    _dependsOn?: string[];         // Dependency step names
    _policy?: {
      tools_allowed?: string[];
      env_allowed?: string[];
      secrets_scope?: string;
    };
  };
}
```

**Event Schema:**
```typescript
interface Event {
  id: string;
  run_id: string;
  step_id?: string;
  type: string;                    // 'run.created', 'step.finished', etc.
  payload: Record<string, any>;
  created_at: string;
}
```

---

## 8. Security & Isolation

### 8.1 Workspace Isolation

**Strategies:**

1. **local_path Mode:**
   - **Risk:** Directly modifies user's codebase
   - **Mitigation:** Requires explicit configuration
   - **Use Case:** Trusted, existing projects

2. **clone Mode:**
   - **Isolation:** Separate directory per project
   - **Path:** `local_data/workspaces/{project.id}`
   - **Cleanup:** Can be deleted without affecting original

3. **worktree Mode:**
   - **Isolation:** Git worktree provides branch-level isolation
   - **Benefits:** Shares git history, isolated working directory
   - **Use Case:** Parallel feature development

### 8.2 Policy Enforcement

**Step-Level Policies:**
```typescript
interface StepPolicy {
  tools_allowed?: string[];      // Whitelist of allowed tools
  env_allowed?: string[];        // Whitelist of env vars
  secrets_scope?: string;        // Access scope for secrets
}
```

**Enforcement in Runner:**
```typescript
const policy = step.inputs._policy || {};

// Tool whitelist
if (policy.tools_allowed?.length > 0) {
  if (!policy.tools_allowed.includes(step.tool)) {
    await store.updateStep(stepId, {
      status: 'failed',
      outputs: { error: 'Tool not allowed by policy' }
    });
    await store.updateRun(runId, { status: 'failed' });
    return;
  }
}

// Environment variable whitelist
if (policy.env_allowed?.length > 0) {
  const requestedEnv = step.inputs.env || [];
  const unauthorized = requestedEnv.filter(v => !policy.env_allowed.includes(v));

  if (unauthorized.length > 0) {
    await store.updateStep(stepId, {
      status: 'failed',
      outputs: { error: 'Environment variables not allowed', unauthorized }
    });
    return;
  }
}
```

### 8.3 Authentication & Authorization

**Admin Authentication:**
```typescript
import { isAdmin, requireAuth } from '../auth/middleware';

// Check admin status
app.get('/admin/dashboard', requireAuth, (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Admin required' });
  }
  // ...
});
```

**User-Level Authorization:**
```typescript
// Runs are scoped to users
const run = await store.createRunWithUser(plan, projectId, req.userId);

// Only list user's runs
const runs = await store.listRunsByUser(req.userId, limit, projectId);
```

**GitHub Token Security:**
```typescript
// Never log tokens
const safeUrl = project.repo_url.replace(/:[^@]+@/, ':***@');
log.info({ repo: safeUrl }, 'Cloning repository');

// Use environment variables
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GitHub token not configured');
}
```

### 8.4 Artifact Integrity

**SHA256 Verification:**
```typescript
// On save
const sha256 = crypto.createHash('sha256').update(content).digest('hex');
await store.addArtifact(stepId, contentType, path, { sha256 });

// On read
const artifact = await store.getArtifact(artifactId);
const content = await readArtifact(artifact.path);
const actualHash = crypto.createHash('sha256').update(content).digest('hex');

if (artifact.metadata.sha256 !== actualHash) {
  throw new Error('Artifact integrity verification failed');
}
```

---

## 9. Configuration & Deployment

### 9.1 Environment Variables

**Core Configuration:**
```bash
# Environment
NODE_ENV=production
VERCEL_ENV=production

# Database (Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/db
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Queue
QUEUE_DRIVER=postgres              # memory | redis | postgres

# Storage
DATA_DRIVER=postgres               # fs | postgres
WORKSPACE_ROOT=/app/workspaces     # Workspace base path

# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Git Integration
GITHUB_TOKEN=ghp_...               # GitHub personal access token

# Agent SDK (Optional)
USE_AGENT_SDK=true
AGENT_SDK_MODEL=claude-sonnet-4
AGENT_SDK_TEMPERATURE=0.7
AGENT_SDK_MAX_TOKENS=4096

# Performance
BACKPRESSURE_AGE_MS=5000           # Queue backpressure threshold
DISABLE_INLINE_RUNNER=0            # Inline execution fallback
```

**Production-Specific:**
```bash
# Vercel
VERCEL=1
VERCEL_URL=nofx-control-plane.vercel.app

# Security
ADMIN_PASSWORD=<secure-password>
ENABLE_ADMIN=true

# Monitoring
LOG_LEVEL=info
TRACE_ENABLED=false
```

### 9.2 Local Development Setup

**Prerequisites:**
- Node.js 20.x LTS
- PostgreSQL (or Supabase account)
- Git

**Setup Steps:**
```bash
# 1. Clone repository
git clone https://github.com/org/nofx-local-starter
cd nofx-local-starter

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Setup database (if using Supabase)
# - Create Supabase project
# - Run migrations: Copy run-supabase-migrations.sql to SQL Editor
# - Update .env with Supabase credentials

# 5. Start development server
npm run dev

# 6. (Optional) Start frontend
npm run fe:dev
```

**Development Endpoints:**
- API: http://localhost:3002
- Frontend: http://localhost:5173
- Health: http://localhost:3002/health

### 9.3 Cloud Deployment (Vercel + Supabase)

**Vercel Setup:**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Configure environment variables
# Go to Vercel Dashboard > Project > Settings > Environment Variables
# Add all required variables from .env
```

**Supabase Setup:**
```bash
# 1. Create project at https://supabase.com

# 2. Run migrations
# - Go to SQL Editor
# - Paste contents of run-supabase-migrations.sql
# - Execute

# 3. Create storage bucket
# - Go to Storage
# - Create bucket: nofx-artifacts
# - Set policy: Private

# 4. Get credentials
# - Go to Settings > API
# - Copy URL and keys to Vercel env vars
```

**Automatic Deployments:**
- Push to `main` → Automatic production deployment
- Pull requests → Preview deployments

### 9.4 Production Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                             │
│                    (Global CDN + SSL)                           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL FUNCTIONS                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ API Routes   │  │ Worker Jobs  │  │ Webhook Handlers     │  │
│  │ (Serverless) │  │ (Serverless) │  │ (Serverless)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ PostgreSQL   │  │ Storage      │  │ Auth (Optional)      │  │
│  │ (Database)   │  │ (Artifacts)  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ GitHub API   │  │ AI Providers │  │ Webhooks             │  │
│  │ (PRs, Repos) │  │ (Anthropic)  │  │ (User Endpoints)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Scaling Considerations:**
- **Vercel Functions:** Auto-scale, 10s timeout (configurable)
- **Database:** Supabase connection pooling, read replicas
- **Storage:** Supabase CDN for artifact delivery
- **Queue:** PostgreSQL-based, no additional infrastructure

---

## 10. Task Decomposition for Development

### 10.1 Understanding Existing System

**Task 1: Map Current Architecture**
- [ ] Review all handlers in `src/worker/handlers/`
- [ ] Document each handler's inputs/outputs
- [ ] Create data flow diagram for each handler
- [ ] Identify integration points with external services

**Task 2: Analyze Storage Patterns**
- [ ] Review `src/lib/store/` implementation
- [ ] Document PostgreSQL vs Filesystem behavior
- [ ] Map artifact storage locations
- [ ] Understand idempotency mechanisms

**Task 3: Study Workspace Management**
- [ ] Review `src/lib/workspaces.ts` implementation
- [ ] Document each workspace mode behavior
- [ ] Test workspace isolation
- [ ] Understand git mode differences

**Task 4: Trace Request Flow**
- [ ] Follow a request from API to completion
- [ ] Document each middleware/handler
- [ ] Map event recording points
- [ ] Understand error handling paths

### 10.2 Enhancement Planning

**Task 5: ChromaDB Integration Design**
- [ ] Identify artifact metadata for indexing
- [ ] Design semantic search interface
- [ ] Plan context storage strategy
- [ ] Create retrieval augmentation workflow

**Task 6: Workflow Optimization**
- [ ] Analyze current bottlenecks
- [ ] Design parallel execution strategies
- [ ] Plan queue optimization
- [ ] Create caching strategies

**Task 7: Git Integration Enhancement**
- [ ] Design advanced PR workflows
- [ ] Plan code review integration
- [ ] Create conflict resolution strategies
- [ ] Design merge queue integration

**Task 8: Security Hardening**
- [ ] Audit policy enforcement
- [ ] Review secret management
- [ ] Plan workspace sandboxing
- [ ] Design permission system

### 10.3 Implementation Tasks

**Task 9: New Handler Development**
```typescript
// Template for new handler
// File: src/worker/handlers/my_handler.ts

import { StepHandler } from './types';
import { store } from '../../lib/store';
import { recordEvent } from '../../lib/events';
import { log } from '../../lib/logger';

const handler: StepHandler = {
  match: (tool) => tool === 'my_handler',

  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, {
      status: 'running',
      started_at: new Date().toISOString()
    });
    await recordEvent(runId, 'step.started', { name: step.name }, stepId);

    try {
      // Validate inputs
      const inputs = step.inputs || {};
      // ... validation logic

      // Execute logic
      const result = await myOperation(inputs);

      // Save outputs
      const outputs = { result };
      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.finished', outputs, stepId);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs: { error: message }
      });
      await recordEvent(runId, 'step.failed', { error: message }, stepId);
      throw error;
    }
  }
};

export default handler;
```

**Task 10: API Endpoint Development**
```typescript
// Template for new API endpoint
// File: src/api/routes/my_route.ts

import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware';

const RequestSchema = z.object({
  // Define schema
});

export default function mount(app: Express) {
  app.post('/my-endpoint', requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate
      const validated = RequestSchema.parse(req.body);

      // Process
      const result = await processRequest(validated);

      // Respond
      res.json({ success: true, data: result });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });
}
```

**Task 11: ChromaDB Integration**
- [ ] Add ChromaDB client dependency
- [ ] Create artifact indexing service
- [ ] Implement semantic search endpoint
- [ ] Build context retrieval for AI
- [ ] Add run similarity matching

**Task 12: Testing & Validation**
- [ ] Write unit tests for new handlers
- [ ] Create integration tests for workflows
- [ ] Add E2E tests for git operations
- [ ] Performance test queue system
- [ ] Security audit for new features

### 10.4 Debugging & Troubleshooting

**Task 13: Create Debugging Tools**
```bash
# Debug run status
curl http://localhost:3002/runs/{runId}

# Stream run events
curl -N http://localhost:3002/runs/{runId}/stream

# Check queue status
curl http://localhost:3002/dev/queue

# List artifacts
curl http://localhost:3002/artifacts/runs/{runId}/steps/{stepId}/
```

**Task 14: Error Recovery Procedures**

**Run Stuck:**
1. Check step statuses: `GET /runs/{runId}`
2. Review events: `GET /runs/{runId}/timeline`
3. Check queue: `GET /dev/queue`
4. Retry failed step: `POST /runs/{runId}/steps/{stepId}/retry`

**Artifact Missing:**
1. Check artifact metadata in database
2. Verify Supabase Storage bucket
3. Check local_data fallback
4. Regenerate if needed: Retry step

**Git Operation Failed:**
1. Check workspace exists and is git repo
2. Verify git credentials in env vars
3. Review git mode for project
4. Check remote URL and access

**Worker Not Processing:**
1. Verify queue driver configuration
2. Check worker is subscribed to topic
3. Review idempotency keys for conflicts
4. Check database connection

### 10.5 Documentation Tasks

**Task 15: User Documentation**
- [ ] Create user guide for different git modes
- [ ] Document workspace mode selection
- [ ] Write project setup tutorial
- [ ] Create PR workflow guide

**Task 16: Developer Documentation**
- [ ] Document handler development pattern
- [ ] Create API integration guide
- [ ] Write deployment procedures
- [ ] Document debugging techniques

**Task 17: Architecture Documentation**
- [ ] Create detailed component diagrams
- [ ] Document all data flows
- [ ] Write configuration guide
- [ ] Create troubleshooting decision tree

---

## 11. ChromaDB Integration Specification

### 11.1 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOFX CONTROL PLANE                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Artifact Generation                          │  │
│  │  (codegen handler creates code artifacts)               │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         ChromaDB Indexing Service                        │  │
│  │  - Extract metadata                                      │  │
│  │  - Generate embeddings                                   │  │
│  │  - Index in ChromaDB                                     │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CHROMADB                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Collections:                                            │  │
│  │  - artifacts: Generated code files                       │  │
│  │  - runs: Run metadata and patterns                       │  │
│  │  - context: Project-specific knowledge                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               RETRIEVAL & SEARCH SERVICES                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - Semantic artifact search                              │  │
│  │  - Context-aware code generation                         │  │
│  │  - Similar run detection                                 │  │
│  │  - Project knowledge base                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Use Cases for ChromaDB

**1. Artifact Semantic Search**
```typescript
// Search for similar code artifacts
const results = await chromadb.search('artifacts', {
  query: "React authentication component with JWT",
  n_results: 5,
  where: { project_id: "my-project" }
});
```

**2. Context-Aware Code Generation**
```typescript
// Enhance AI prompts with relevant context
const context = await chromadb.search('artifacts', {
  query: step.inputs.prompt,
  n_results: 3,
  where: { project_id: projectId, type: 'code' }
});

const enhancedPrompt = `
${step.inputs.prompt}

Relevant existing code:
${context.documents.join('\n\n')}
`;
```

**3. Run Pattern Detection**
```typescript
// Find similar runs for workflow suggestions
const similarRuns = await chromadb.search('runs', {
  query: run.goal,
  n_results: 10
});

// Suggest optimizations based on historical data
const suggestions = analyzePatternsForOptimization(similarRuns);
```

**4. Project Knowledge Base**
```typescript
// Store project-specific patterns and conventions
await chromadb.add('context', {
  documents: [codeConventions, architecturePatterns],
  metadatas: [{ project_id, type: 'conventions' }],
  ids: [generateId()]
});

// Retrieve for consistent code generation
const projectContext = await chromadb.query('context', {
  where: { project_id, type: 'conventions' }
});
```

### 11.3 Implementation Tasks

**Task: ChromaDB Service Layer**
```typescript
// File: src/lib/chromadb/index.ts

import { ChromaClient, Collection } from 'chromadb';

export class ChromaDBService {
  private client: ChromaClient;
  private collections: Map<string, Collection>;

  async initialize() {
    this.client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000'
    });

    // Create collections
    this.collections.set(
      'artifacts',
      await this.client.getOrCreateCollection({
        name: 'artifacts',
        metadata: { description: 'Generated code artifacts' }
      })
    );

    this.collections.set(
      'runs',
      await this.client.getOrCreateCollection({
        name: 'runs',
        metadata: { description: 'Run patterns and metadata' }
      })
    );

    this.collections.set(
      'context',
      await this.client.getOrCreateCollection({
        name: 'project_context',
        metadata: { description: 'Project-specific knowledge' }
      })
    );
  }

  async indexArtifact(artifact: {
    id: string;
    content: string;
    metadata: Record<string, any>;
  }) {
    const collection = this.collections.get('artifacts');
    await collection.add({
      ids: [artifact.id],
      documents: [artifact.content],
      metadatas: [artifact.metadata]
    });
  }

  async searchArtifacts(query: string, filter?: Record<string, any>, limit = 5) {
    const collection = this.collections.get('artifacts');
    return await collection.query({
      queryTexts: [query],
      nResults: limit,
      where: filter
    });
  }

  async indexRun(run: {
    id: string;
    goal: string;
    metadata: Record<string, any>;
  }) {
    const collection = this.collections.get('runs');
    await collection.add({
      ids: [run.id],
      documents: [run.goal],
      metadatas: [run.metadata]
    });
  }

  async findSimilarRuns(goal: string, limit = 10) {
    const collection = this.collections.get('runs');
    return await collection.query({
      queryTexts: [goal],
      nResults: limit
    });
  }
}

export const chromadb = new ChromaDBService();
```

**Task: Artifact Indexing Hook**
```typescript
// File: src/worker/handlers/codegen.ts (enhancement)

import { chromadb } from '../../lib/chromadb';

async function executeWithModelRouter(runId: string, step: any) {
  // ... existing code generation ...

  // Index artifact in ChromaDB
  await chromadb.indexArtifact({
    id: `${runId}:${stepId}:${filename}`,
    content: result.content,
    metadata: {
      run_id: runId,
      step_id: stepId,
      project_id: step.inputs.projectId || 'default',
      type: 'code',
      language: detectLanguage(filename),
      created_at: new Date().toISOString()
    }
  });
}
```

**Task: Context-Enhanced Code Generation**
```typescript
// File: src/tools/codegen.ts (enhancement)

import { chromadb } from '../lib/chromadb';

export async function codegenWithContext(inputs: any) {
  // Search for relevant context
  const context = await chromadb.searchArtifacts(
    inputs.prompt,
    { project_id: inputs.projectId, type: 'code' },
    3
  );

  // Enhance prompt with context
  const contextualPrompt = `
${inputs.prompt}

Consider these existing patterns in the project:
${context.documents.map((doc, i) => `
Example ${i + 1}:
\`\`\`
${doc}
\`\`\`
`).join('\n')}

Generate code that follows similar patterns and conventions.
`;

  // Generate with enhanced prompt
  const result = await routeCompletion({
    messages: [
      { role: 'system', content: 'You are a code generator.' },
      { role: 'user', content: contextualPrompt }
    ],
    model: inputs.model || 'claude-sonnet-4'
  });

  return result;
}
```

---

## 12. Conclusion & Next Steps

### Summary

This specification provides a comprehensive understanding of how the NOFX Control Plane handles GitHub repositories and file changes through:

1. **Artifact-Based Workflow**: Two-stage process separating generation from workspace write
2. **Workspace Isolation**: Three modes for different security/usage requirements
3. **Adaptive Git Operations**: UI complexity matching user expertise
4. **Cloud-Native Architecture**: Fully deployed on Vercel + Supabase
5. **Exactly-Once Execution**: Idempotency ensuring reliable operations

### ChromaDB Enhancement Opportunities

ChromaDB integration can significantly enhance:
- **Context-Aware Generation**: Use similar code for better AI outputs
- **Artifact Discovery**: Semantic search across generated code
- **Workflow Intelligence**: Pattern-based optimization suggestions
- **Project Knowledge**: Persistent context for consistent code generation

### Recommended Next Actions

1. **Onboarding:** Use this spec to understand system architecture
2. **Enhancement:** Implement ChromaDB integration for context-aware generation
3. **Optimization:** Identify bottlenecks using workflow analysis
4. **Extension:** Add new handlers following documented patterns
5. **Documentation:** Create user guides for different personas

### Key Files Reference

- **Workspace Management:** `/Volumes/Development/nofx-local-starter/src/lib/workspaces.ts`
- **Artifact Storage:** `/Volumes/Development/nofx-local-starter/src/lib/artifacts.ts`
- **Step Execution:** `/Volumes/Development/nofx-local-starter/src/worker/runner.ts`
- **Run Handlers:** `/Volumes/Development/nofx-local-starter/src/api/server/handlers/runs.ts`
- **Git Operations:** `/Volumes/Development/nofx-local-starter/src/worker/handlers/git_ops.ts`
- **Project Config:** `/Volumes/Development/nofx-local-starter/src/lib/projects.ts`
- **Code Generation:** `/Volumes/Development/nofx-local-starter/src/worker/handlers/codegen.ts`

---

**Document Version:** 1.0
**Author:** System Architecture Analysis
**Date:** 2025-10-12
**Status:** Production Ready
