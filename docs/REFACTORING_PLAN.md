# NOFX Control Plane Refactoring Plan

## Executive Summary
This plan addresses critical code organization issues following SOLID principles and clean architecture patterns. The refactoring will be done incrementally without breaking functionality.

## Critical Issues Identified

### 1. Files Exceeding 500 Lines (URGENT)
- **`src/lib/store.ts`** - 582 lines ❌ (God class anti-pattern)
- **`src/services/responses/runtime.ts`** - 460 lines ⚠️
- **`src/services/responses/runCoordinator.ts`** - 453 lines ⚠️
- **`src/services/responses/archiveStore.ts`** - 450 lines ⚠️

### 2. Mixed Responsibilities
- API routes handling business logic
- Handlers doing multiple unrelated tasks
- Store.ts managing database, filesystem, AND Supabase operations

### 3. Lack of Clear Separation
- No clear Manager/Service/Repository pattern
- Business logic mixed with infrastructure code
- Missing dependency injection

## Refactoring Strategy

### Phase 1: Break Up God Classes (Priority: CRITICAL)

#### 1.1 Refactor `src/lib/store.ts` (582 lines → ~100 lines each)

**Current Problems:**
- Handles runs, steps, artifacts, events, gates, settings, models, projects
- Mixes database and filesystem operations
- No separation of concerns

**New Structure:**
```
src/lib/store/
├── index.ts                 # Store facade (coordinator)
├── interfaces/
│   ├── IRunRepository.ts
│   ├── IStepRepository.ts
│   ├── IArtifactRepository.ts
│   ├── IEventRepository.ts
│   └── IStorageAdapter.ts
├── repositories/
│   ├── RunRepository.ts     # Run CRUD operations
│   ├── StepRepository.ts    # Step CRUD operations
│   ├── ArtifactRepository.ts # Artifact CRUD operations
│   ├── EventRepository.ts   # Event logging
│   ├── GateRepository.ts    # Gate management
│   └── SettingsRepository.ts # Settings CRUD
├── adapters/
│   ├── PostgresAdapter.ts   # Database implementation
│   ├── FilesystemAdapter.ts # File storage implementation
│   └── SupabaseAdapter.ts   # Supabase storage
└── factories/
    └── StoreFactory.ts      # Creates appropriate store based on config
```

**Migration Steps:**
1. Create interfaces for each repository
2. Extract run-related methods to RunRepository
3. Extract step-related methods to StepRepository
4. Continue for each domain
5. Create Store facade that delegates to repositories
6. Update all imports to use new structure

#### 1.2 Refactor Response Services (450+ lines each)

**New Structure:**
```
src/services/responses/
├── coordinators/
│   ├── RunCoordinator.ts       # Orchestrates run operations
│   └── IncidentCoordinator.ts  # Manages incidents
├── repositories/
│   ├── ArchiveRepository.ts    # Archive data access
│   ├── MetricsRepository.ts    # Metrics storage
│   └── StreamRepository.ts     # Stream management
├── services/
│   ├── RunService.ts           # Business logic for runs
│   ├── RetryService.ts         # Retry logic
│   └── RollbackService.ts      # Rollback operations
├── managers/
│   ├── BufferManager.ts        # Stream buffer management
│   ├── CacheManager.ts         # Cache operations
│   └── StateManager.ts         # State transitions
└── types/
    └── responses.types.ts      # Shared types
```

### Phase 2: Apply Single Responsibility Principle

#### 2.1 Split Multi-Purpose Handlers

**Current `gate.ts` (185 lines) splits into:**
```
src/worker/handlers/gates/
├── index.ts                    # Gate handler registry
├── GateExecutor.ts            # Executes gate checks
├── GateValidator.ts           # Validates gate conditions
├── gates/
│   ├── TypecheckGate.ts      # Typecheck implementation
│   ├── TestGate.ts           # Test runner gate
│   ├── LintGate.ts          # Linting gate
│   └── SecurityGate.ts      # Security checks
└── utils/
    └── GateUtils.ts          # Shared gate utilities
```

#### 2.2 Separate API Routes from Business Logic

**Current `main.ts` (355 lines) becomes:**
```
src/
├── api/
│   ├── main.ts              # Express setup only (~50 lines)
│   ├── middleware/
│   │   ├── auth.ts         # Authentication
│   │   ├── cors.ts         # CORS config
│   │   ├── errorHandler.ts # Global error handling
│   │   └── observability.ts # Logging/tracing
│   └── controllers/
│       ├── RunController.ts # Run endpoints
│       └── HealthController.ts # Health checks
├── services/
│   ├── RunService.ts       # Run business logic
│   ├── StepService.ts      # Step orchestration
│   └── QueueService.ts     # Queue management
└── managers/
    ├── RunManager.ts       # Coordinates run lifecycle
    └── StepManager.ts      # Manages step execution
```

### Phase 3: Introduce Manager/Coordinator Pattern

#### 3.1 Create Clear Separation of Concerns

```typescript
// RunCoordinator.ts - Orchestrates the entire run lifecycle
export class RunCoordinator {
  constructor(
    private runService: IRunService,
    private stepManager: IStepManager,
    private eventBus: IEventBus,
    private queueManager: IQueueManager
  ) {}

  async createRun(plan: Plan): Promise<Run> {
    // Coordinates between services
  }
}

// RunService.ts - Business logic only
export class RunService implements IRunService {
  constructor(private repository: IRunRepository) {}

  async validatePlan(plan: Plan): Promise<ValidationResult> {
    // Pure business logic
  }
}

// RunRepository.ts - Data access only
export class RunRepository implements IRunRepository {
  constructor(private db: IDatabase) {}

  async create(run: Run): Promise<Run> {
    // Database operations only
  }
}
```

### Phase 4: Implement Dependency Injection

#### 4.1 Create IoC Container

```typescript
// src/container/index.ts
import { Container } from 'inversify';

const container = new Container();

// Register repositories
container.bind<IRunRepository>(TYPES.RunRepository).to(RunRepository);
container.bind<IStepRepository>(TYPES.StepRepository).to(StepRepository);

// Register services
container.bind<IRunService>(TYPES.RunService).to(RunService);

// Register coordinators
container.bind<IRunCoordinator>(TYPES.RunCoordinator).to(RunCoordinator);

export { container };
```

### Phase 5: Create Modular, Testable Components

#### 5.1 Example of Refactored Codegen Handler

```typescript
// src/worker/handlers/codegen/
├── CodegenHandler.ts        # Main handler (< 50 lines)
├── services/
│   ├── PromptBuilder.ts    # Builds AI prompts
│   ├── ModelSelector.ts    # Selects appropriate model
│   └── ResponseProcessor.ts # Processes AI responses
├── managers/
│   ├── ArtifactManager.ts  # Manages artifact creation
│   └── OutputManager.ts    # Handles output storage
└── validators/
    └── InputValidator.ts   # Validates handler inputs
```

## Implementation Plan

### Week 1: Foundation
1. Set up dependency injection container
2. Create all interface definitions
3. Set up new folder structure
4. Add unit test scaffolding

### Week 2: Store Refactoring
1. Extract RunRepository (Day 1-2)
2. Extract StepRepository (Day 3)
3. Extract ArtifactRepository (Day 4)
4. Extract EventRepository (Day 5)
5. Create Store facade and update imports

### Week 3: API Refactoring
1. Extract controllers from main.ts
2. Create service layer
3. Implement manager pattern
4. Update route handlers to use controllers

### Week 4: Handler Refactoring
1. Refactor codegen handler
2. Split gate handlers
3. Refactor git_pr handler
4. Update worker runner to use new structure

### Week 5: Testing & Migration
1. Write unit tests for all new components
2. Integration testing
3. Performance testing
4. Documentation updates

## Success Metrics

### Code Quality
- [ ] No file exceeds 400 lines
- [ ] Average file size < 150 lines
- [ ] Each class has single responsibility
- [ ] 90%+ test coverage

### Architecture
- [ ] Clear separation: Controller → Service → Repository
- [ ] Dependency injection throughout
- [ ] All business logic in services/managers
- [ ] All data access in repositories

### Maintainability
- [ ] Any component can be replaced without affecting others
- [ ] New features can be added without modifying existing code
- [ ] Clear naming conventions followed
- [ ] Comprehensive documentation

## Migration Safety Checklist

### For Each Refactoring:
1. **Create new structure alongside old**
   - Don't delete old code immediately
   - Run both in parallel initially

2. **Write tests first**
   - Unit tests for new components
   - Integration tests for workflows
   - Regression tests for existing functionality

3. **Incremental migration**
   - Migrate one component at a time
   - Feature flag for switching between old/new
   - Monitor for issues after each migration

4. **Rollback plan**
   - Keep old code for 2 weeks after migration
   - Document rollback procedure
   - Test rollback process

## Example: Refactoring store.ts (Step-by-Step)

### Step 1: Create Interface
```typescript
// src/lib/store/interfaces/IRunRepository.ts
export interface IRunRepository {
  createRun(plan: Plan, projectId: string): Promise<Run>;
  getRun(runId: string): Promise<Run | null>;
  updateRunStatus(runId: string, status: RunStatus): Promise<void>;
  listRuns(limit: number, projectId?: string): Promise<Run[]>;
}
```

### Step 2: Implement Repository
```typescript
// src/lib/store/repositories/RunRepository.ts
export class RunRepository implements IRunRepository {
  constructor(private adapter: IStorageAdapter) {}

  async createRun(plan: Plan, projectId: string): Promise<Run> {
    // Single responsibility: Run CRUD only
    const run: Run = {
      id: uuid(),
      plan,
      project_id: projectId,
      status: 'pending',
      created_at: new Date()
    };

    await this.adapter.insert('run', run);
    return run;
  }

  // Other methods...
}
```

### Step 3: Update Store Facade
```typescript
// src/lib/store/index.ts
export class Store {
  private runRepository: IRunRepository;
  private stepRepository: IStepRepository;

  constructor(config: StoreConfig) {
    const adapter = AdapterFactory.create(config);
    this.runRepository = new RunRepository(adapter);
    this.stepRepository = new StepRepository(adapter);
  }

  // Delegate to repositories
  createRun(plan: Plan, projectId: string): Promise<Run> {
    return this.runRepository.createRun(plan, projectId);
  }
}
```

### Step 4: Update Imports Gradually
```typescript
// Old way (still works during migration)
import { store } from '../lib/store';
await store.createRun(plan, projectId);

// New way (after migration)
import { container } from '../container';
const runRepository = container.get<IRunRepository>(TYPES.RunRepository);
await runRepository.createRun(plan, projectId);
```

## Anti-Patterns to Fix

### Current Issues:
1. **God Object**: store.ts knows everything
2. **Anemic Domain Model**: No business logic in models
3. **Service Locator**: Direct imports instead of DI
4. **Mixed Concerns**: Routes handle business logic
5. **Large Classes**: 500+ line files

### After Refactoring:
1. **Single Responsibility**: Each class does one thing
2. **Rich Domain Model**: Business logic in domain services
3. **Dependency Injection**: IoC container manages dependencies
4. **Clear Layers**: Controller → Service → Repository
5. **Small, Focused Classes**: <200 lines each

## Notes for Implementation

1. **Don't break existing functionality**
   - All refactoring must maintain backward compatibility
   - Use adapter pattern to wrap new implementations

2. **Test everything**
   - Write tests for new code before removing old
   - Ensure 100% feature parity

3. **Document as you go**
   - Update AI_CODER_GUIDE.md with new patterns
   - Add JSDoc to all new interfaces

4. **Performance considerations**
   - Profile before and after refactoring
   - Ensure no performance degradation

---

*This refactoring will transform NOFX from a monolithic structure to a modular, scalable, enterprise-grade architecture while maintaining all existing functionality.*