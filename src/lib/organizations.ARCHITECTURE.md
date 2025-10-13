# Organization Types Architecture

## Type Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Organization                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ id, name, slug, owner_id                                │   │
│  │ created_at, updated_at, metadata                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Settings     │  │   Quotas     │  │     Usage        │   │
│  │ ┌────────────┐ │  │ max_projects │  │ projects_count   │   │
│  │ │isolation   │ │  │ max_runs     │  │ runs_this_month  │   │
│  │ │features    │ │  │ max_storage  │  │ storage_used_gb  │   │
│  │ │security    │ │  │ max_members  │  │ members_count    │   │
│  │ └────────────┘ │  │ ...          │  │ ...              │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Billing Info                          │  │
│  │  plan, status, stripe_customer_id                        │  │
│  │  current_period_start, current_period_end                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Relationship Model

```
┌──────────────┐         ┌────────────────────┐         ┌──────────┐
│              │         │                    │         │          │
│  auth.users  │◄────────│ OrganizationMember │────────►│   Org    │
│              │  many   │                    │  many   │          │
│  - id        │         │ - organization_id  │         │ - id     │
│  - email     │         │ - user_id          │         │ - name   │
│              │         │ - role             │         │ - slug   │
└──────────────┘         │ - permissions      │         └────┬─────┘
                         └────────────────────┘              │
                                                             │
                         ┌────────────────────┐              │
                         │                    │              │
                         │ OrganizationInvite │              │
                         │                    │              │
                         │ - organization_id  ├──────────────┘
                         │ - email            │
                         │ - role             │
                         │ - token            │
                         │ - status           │
                         └────────────────────┘
```

## Project & Resource Isolation

```
┌────────────────────────────────────────────────────────────────┐
│                       Organization                             │
│                       (org_abc123)                             │
└─────┬────────────────────────────────────────────────────┬─────┘
      │                                                    │
      │ owns                                               │ owns
      ▼                                                    ▼
┌──────────────────┐                              ┌─────────────────┐
│    Projects      │                              │   Workspaces    │
│                  │                              │                 │
│ - proj_1         │                              │ - workspace_1   │
│   org_abc123     │                              │   org_abc123    │
│                  │                              │   /ws/org/p1/   │
│ - proj_2         │                              │                 │
│   org_abc123     │                              │ - workspace_2   │
│                  │                              │   org_abc123    │
└────────┬─────────┘                              │   /ws/org/p2/   │
         │                                        └────────┬────────┘
         │ generates                                       │
         ▼                                                 │ stores
┌──────────────────┐                              ┌────────▼────────┐
│      Runs        │                              │   Artifacts     │
│                  │                              │                 │
│ - run_1          │──────────creates────────────►│ - artifact_1    │
│   org_abc123     │                              │   org_abc123    │
│   proj_1         │                              │   run_1         │
│                  │                              │   /artifacts/   │
│ - run_2          │──────────creates────────────►│ - artifact_2    │
│   org_abc123     │                              │   org_abc123    │
│   proj_2         │                              │   run_2         │
└──────────────────┘                              └─────────────────┘
```

## Permission Flow

```
┌──────────────┐
│     User     │
│  user_xyz    │
└──────┬───────┘
       │
       │ has
       ▼
┌──────────────────────┐
│   Membership         │
│                      │
│ org: org_abc         │
│ role: MEMBER         │
│ permissions: [...]   │
└──────────┬───────────┘
           │
           │ grants
           ▼
┌─────────────────────────────┐
│   Computed Permissions      │
│                             │
│ ✓ PROJECTS_READ             │
│ ✓ PROJECTS_WRITE            │
│ ✓ RUNS_READ                 │
│ ✓ RUNS_WRITE                │
│ ✗ MEMBERS_WRITE             │
│ ✗ BILLING_MANAGE            │
└─────────────────────────────┘
```

## Role Hierarchy

```
┌─────────────────────────────────────────┐
│              OWNER                      │  ← All permissions
│  • Full organization control            │
│  • Can delete organization              │
│  • Manage billing                       │
├─────────────────────────────────────────┤
│              ADMIN                      │  ← Management permissions
│  • Manage members                       │
│  • All resource operations              │
│  • Update settings                      │
├─────────────────────────────────────────┤
│              MEMBER                     │  ← Standard permissions
│  • Create projects & runs               │
│  • View organization                    │
│  • Manage own resources                 │
├─────────────────────────────────────────┤
│              VIEWER                     │  ← Read-only
│  • View projects & runs                 │
│  • View organization                    │
│  • No modification rights               │
└─────────────────────────────────────────┘
```

## Subscription & Quota Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Subscription Status                      │
└────┬─────────────────────┬─────────────────────┬───────────┘
     │                     │                     │
     │ ACTIVE/TRIALING     │ PAST_DUE            │ CANCELED
     ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Full Access │      │ Grace Period│      │  Blocked    │
└─────┬───────┘      └──────┬──────┘      └──────┬──────┘
      │                     │                    │
      │ check quotas        │ limited access     │ read-only
      ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Quota Enforcement                        │
│                                                             │
│  Usage < Quota  →  ✓ Allow operation                       │
│  Usage ≥ Quota  →  ✗ Reject with 429 (Too Many Requests)   │
│  Quota = -1     →  ∞ Unlimited (Enterprise)                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Creating a Run

```
1. User Request
   ↓
   POST /runs { plan, project_id }
   ↓
2. Authentication & Organization Context
   ↓
   Extract user_id from JWT
   ↓
   Find membership: OrganizationMembership
   ↓
3. Permission Check
   ↓
   hasPermission(RUNS_WRITE) ?
   ↓ YES
4. Quota Validation
   ↓
   hasActiveSubscription() ?
   ↓ YES
   hasExceededQuota('max_runs_per_month') ?
   ↓ NO
   hasExceededQuota('max_concurrent_runs') ?
   ↓ NO
5. Resource Creation
   ↓
   Create run with organization_id
   ↓
   Create workspace in org namespace
   ↓
   Update usage counters
   ↓
6. Return Success
   ↓
   { success: true, run_id: 'run_123' }
```

## Type Safety Guarantees

```typescript
// ✓ Compile-time type checking
const org: Organization = {
  id: 'org_123',
  name: 'Acme',
  slug: 'acme',
  owner_id: 'user_xyz',
  settings: { /* typed */ },
  quotas: { /* typed */ },
  usage: { /* typed */ },
  billing: { /* typed */ },
  created_at: '2025-10-13T00:00:00Z',
  updated_at: '2025-10-13T00:00:00Z',
};

// ✓ Runtime validation with type guards
if (isOrganization(apiResponse)) {
  // TypeScript knows this is Organization
  processOrganization(apiResponse);
}

// ✓ Enum safety
const role: OrganizationRole = OrganizationRole.MEMBER;
// role can only be: OWNER | ADMIN | MEMBER | VIEWER

// ✓ Readonly fields prevent mutation
org.id = 'new_id';  // ✗ Error: Cannot assign to 'id' because it is a read-only property

// ✓ JsonValue ensures serializability
const metadata: JsonValue = {
  nested: {
    data: [1, 2, 3],
    valid: true,
  },
  // function: () => {} // ✗ Error: Not assignable to JsonValue
};
```

## Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│                    NOFX Control Plane                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐         ┌─────────────────┐            │
│  │  Auth System   │────────►│  Organizations  │            │
│  │  (Supabase)    │  user_id│  (This Module)  │            │
│  └────────────────┘         └────────┬────────┘            │
│                                      │                      │
│                                      │ organization_id      │
│                                      ▼                      │
│  ┌────────────────┐         ┌─────────────────┐            │
│  │   Projects     │◄────────│   Project       │            │
│  │   (Existing)   │         │   Extension     │            │
│  └────────────────┘         └─────────────────┘            │
│         │                            │                      │
│         │ project_id                 │                      │
│         ▼                            ▼                      │
│  ┌────────────────┐         ┌─────────────────┐            │
│  │     Runs       │         │   Workspaces    │            │
│  │   (Existing)   │         │   (Isolated)    │            │
│  └────────────────┘         └─────────────────┘            │
│         │                            │                      │
│         │ run_id                     │ artifacts            │
│         ▼                            ▼                      │
│  ┌────────────────┐         ┌─────────────────┐            │
│  │   Artifacts    │◄────────│   Storage       │            │
│  │   (Extended)   │         │   (Isolated)    │            │
│  └────────────────┘         └─────────────────┘            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Security Boundaries

```
┌───────────────────────────────────────────────────────────────┐
│                     Organization A (org_abc)                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Users: user_1 (owner), user_2 (member)                      │
│                                                               │
│  Projects: proj_a1, proj_a2                                   │
│  └─ Runs: run_a1, run_a2                                      │
│     └─ Artifacts: artifact_a1, artifact_a2                    │
│                                                               │
│  Workspaces: /workspaces/org_abc/...                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                             ⚡ ISOLATION ⚡
┌───────────────────────────────────────────────────────────────┐
│                     Organization B (org_xyz)                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Users: user_3 (owner), user_4 (admin)                       │
│                                                               │
│  Projects: proj_b1                                            │
│  └─ Runs: run_b1                                              │
│     └─ Artifacts: artifact_b1                                 │
│                                                               │
│  Workspaces: /workspaces/org_xyz/...                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘

Rules:
  • user_1 CANNOT access proj_b1 (different org)
  • user_3 CANNOT access artifact_a1 (different org)
  • Workspaces are completely isolated by org
  • Database queries ALWAYS filter by organization_id
  • API endpoints enforce organization membership
```

## Key Design Principles

1. **Type Safety First**
   - No `any` types
   - Strict TypeScript mode
   - Runtime type guards
   - Compile-time validation

2. **Least Privilege**
   - Default to minimum permissions
   - Explicit permission grants
   - Role-based defaults
   - Custom permission overrides

3. **Quota Enforcement**
   - Check before operations
   - Fail fast with clear errors
   - Track usage in real-time
   - Prevent resource exhaustion

4. **Isolation by Default**
   - Organization-scoped queries
   - Separate workspaces
   - Access control at every layer
   - No cross-org data leakage

5. **Auditability**
   - All changes tracked
   - Permission changes logged
   - Usage tracked over time
   - Billing events recorded

## File Organization

```
src/lib/
├── organizations.types.ts          (1106 lines)
│   └── Core type definitions
│       ├── Enums (Role, Permission, Plan, Status)
│       ├── Interfaces (Organization, Membership, etc)
│       ├── Type Guards (isOrganization, etc)
│       └── Utility Functions (hasMinimumRole, etc)
│
├── organizations.example.ts        (447 lines)
│   └── Usage examples
│       ├── Creating organizations
│       ├── Managing members
│       ├── Permission checking
│       ├── Quota management
│       └── Project isolation
│
├── organizations.README.md         (565 lines)
│   └── Documentation
│       ├── API reference
│       ├── Usage examples
│       ├── Best practices
│       └── Integration guide
│
└── organizations.ARCHITECTURE.md   (this file)
    └── Architecture diagrams
        ├── Type hierarchy
        ├── Relationship models
        ├── Data flows
        └── Security boundaries
```
