# Organization Multi-Tenancy Migration

## Overview
This migration implements a comprehensive organization-based multi-tenancy system for the NOFX Control Plane, enabling multiple users to collaborate within organizations with role-based access control, resource quotas, and complete data isolation.

## Migration Details

**Migration ID:** `20251013000000_add_organizations`
**Created:** 2025-10-13
**Status:** Ready for deployment

## Files Created

1. **`20251013000000_add_organizations.sql`** (576 lines)
   - Main migration script with all schema changes
   - Creates 4 new tables with comprehensive constraints
   - Adds 31+ database objects (tables, indexes, triggers, functions)

2. **`20251013000000_add_organizations_rollback.sql`** (128 lines)
   - Complete rollback script
   - Safely removes all organization-related objects
   - Preserves data integrity during rollback

## Database Schema Changes

### New Tables

#### 1. `nofx.organizations`
Core organization entity with:
- **Primary Key:** `id` (TEXT) - Format: `org_` + random hex
- **Unique Constraint:** `slug` (1-63 chars, lowercase, alphanumeric + hyphens)
- **Fields:**
  - `name` (TEXT, 1-255 chars)
  - `owner_id` (UUID, references `auth.users`)
  - `description`, `avatar_url` (optional)
  - `settings` (JSONB) - isolation_level, features, notifications, security
  - `metadata` (JSONB) - extensible data
  - `created_at`, `updated_at` (TIMESTAMPTZ)

#### 2. `nofx.organization_members`
User-organization membership with roles:
- **Primary Key:** `id` (UUID)
- **Unique Constraint:** `(organization_id, user_id)`
- **Fields:**
  - `organization_id` (TEXT, FK to organizations)
  - `user_id` (UUID, FK to auth.users)
  - `role` (TEXT) - owner, admin, member, viewer
  - `permissions` (JSONB) - custom permission overrides
  - `permission_metadata` (JSONB)
  - `joined_at`, `updated_at` (TIMESTAMPTZ)

#### 3. `nofx.organization_invites`
Pending invitations to join organizations:
- **Primary Key:** `id` (UUID)
- **Unique Constraint:** `token` (secure random 64-char hex)
- **Fields:**
  - `organization_id` (TEXT, FK to organizations)
  - `inviter_id` (UUID, FK to auth.users)
  - `email` (TEXT, validated format)
  - `role` (TEXT) - admin, member, viewer
  - `token` (TEXT) - secure invitation token
  - `status` (TEXT) - pending, accepted, expired, revoked
  - `message` (TEXT, optional)
  - `expires_at` (TIMESTAMPTZ, default +7 days)
  - `accepted_at`, `created_at`, `updated_at` (TIMESTAMPTZ)

#### 4. `nofx.organization_quotas`
Resource quotas and usage tracking:
- **Primary Key:** `organization_id` (TEXT, FK to organizations)
- **Subscription Fields:**
  - `plan` (TEXT) - free, professional, team, enterprise
  - `subscription_status` (TEXT) - Stripe-compatible statuses
  - `stripe_customer_id`, `stripe_subscription_id`
  - `billing_email`, billing period timestamps
  - Payment method details

- **Quota Limits (all INTEGER, -1 = unlimited):**
  - `max_projects`, `max_concurrent_runs`
  - `max_runs_per_month`, `max_api_calls_per_month`
  - `max_storage_gb`, `max_members`
  - `max_artifacts_per_run`, `max_compute_minutes_per_month`
  - `max_artifact_retention_days`, `rate_limit_per_minute`

- **Current Usage (tracked in real-time):**
  - `current_projects`, `current_concurrent_runs`
  - `current_runs_this_month`, `current_api_calls_this_month`
  - `current_storage_gb`, `current_members`
  - `current_artifacts`, `current_compute_minutes_this_month`
  - `usage_last_calculated_at` (TIMESTAMPTZ)

### Modified Tables

#### `nofx.project`
- **Added Column:** `organization_id` (TEXT, nullable)
- **Added Constraint:** Foreign key to `nofx.organizations(id)` with CASCADE delete
- **Added Index:** `idx_project_organization_id`

## Indexes Created (17 total)

### Organizations (3 indexes)
- `idx_organizations_owner_id` - Query by owner
- `idx_organizations_slug` - URL routing
- `idx_organizations_created_at` - Time-based queries

### Organization Members (4 indexes)
- `idx_organization_members_organization_id` - Membership lookup
- `idx_organization_members_user_id` - User's organizations
- `idx_organization_members_role` - Role-based queries
- `idx_organization_members_joined_at` - Chronological listing

### Organization Invites (5 indexes)
- `idx_organization_invites_organization_id` - Org's invites
- `idx_organization_invites_email` - Invite lookup by email
- `idx_organization_invites_token` - Token validation
- `idx_organization_invites_status` - Status filtering
- `idx_organization_invites_expires_at` - Expiration cleanup

### Organization Quotas (3 indexes)
- `idx_organization_quotas_stripe_customer_id` - Stripe integration
- `idx_organization_quotas_plan` - Plan-based queries
- `idx_organization_quotas_subscription_status` - Status filtering

### Projects (1 index)
- `idx_project_organization_id` - Project isolation queries

## Functions Created (3 total)

### 1. `nofx.create_default_organization()`
**Trigger Function** - Automatically executed on new user registration
- Creates a default organization for new users
- Generates unique org ID, name, and slug
- Adds user as organization owner
- Creates free tier quotas with 14-day trial
- Returns: TRIGGER

### 2. `nofx.accept_organization_invite(invite_token TEXT)`
**API Function** - Accepts an organization invitation
- Validates token, expiration, and email match
- Adds user to organization with specified role
- Updates invite status to 'accepted'
- Updates member count in quotas
- Returns: JSONB `{success: boolean, organization_id?, role?, error?}`

### 3. `nofx.update_organization_usage(p_organization_id TEXT)`
**Utility Function** - Recalculates usage counters
- Updates current_projects count
- Updates current_members count
- Sets usage_last_calculated_at timestamp
- Returns: VOID

## Triggers Created (5 total)

1. **`on_auth_user_created_organization`** - On `auth.users` INSERT
   - Calls `nofx.create_default_organization()`

2. **`update_organizations_updated_at`** - On `nofx.organizations` UPDATE
   - Updates `updated_at` timestamp

3. **`update_organization_members_updated_at`** - On `nofx.organization_members` UPDATE
   - Updates `updated_at` timestamp

4. **`update_organization_invites_updated_at`** - On `nofx.organization_invites` UPDATE
   - Updates `updated_at` timestamp

5. **`update_organization_quotas_updated_at`** - On `nofx.organization_quotas` UPDATE
   - Updates `updated_at` timestamp

## Row Level Security (RLS)

All tables have RLS enabled with comprehensive policies:

### Organizations (4 policies)
- ✓ Users can view organizations they belong to
- ✓ Organization owners can update their organizations
- ✓ Users can create organizations
- ✓ Organization owners can delete their organizations

### Organization Members (2 policies)
- ✓ Organization members can view their organization's members
- ✓ Organization admins can manage members (owner, admin roles only)

### Organization Invites (2 policies)
- ✓ Organization members can view their organization's invites
- ✓ Organization admins can manage invites (owner, admin roles only)

### Organization Quotas (2 policies)
- ✓ Organization members can view their organization's quotas
- ✓ Organization owners can update their organization's quotas (owner role only)

## Grants

### Authenticated Users
- **Organizations:** SELECT, INSERT, UPDATE, DELETE
- **Organization Members:** SELECT, INSERT, UPDATE, DELETE
- **Organization Invites:** SELECT, INSERT, UPDATE, DELETE
- **Organization Quotas:** SELECT, UPDATE
- **Functions:** EXECUTE on all organization functions

### Service Role
- **All Tables:** Full access (SELECT, INSERT, UPDATE, DELETE)

## Data Validation & Constraints

### Check Constraints
1. **organizations.name_length** - Name must be 1-255 characters
2. **organizations.slug_format** - Slug must match regex `^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$`
3. **organization_members.valid_role** - Role in (owner, admin, member, viewer)
4. **organization_invites.valid_role** - Role in (admin, member, viewer)
5. **organization_invites.valid_status** - Status in (pending, accepted, expired, revoked)
6. **organization_invites.email_format** - Valid email format
7. **organization_quotas.valid_plan** - Plan in (free, professional, team, enterprise)
8. **organization_quotas.valid_status** - Stripe-compatible subscription statuses
9. **organization_quotas.positive_limits** - All max_* fields >= -1
10. **organization_quotas.positive_usage** - All current_* fields >= 0

### Foreign Key Constraints
- All organization_id references cascade on delete
- All user_id references handled appropriately (cascade or restrict)
- Project organization_id cascades on organization deletion

## Default Quota Tiers

### Free Tier (Default)
- Projects: 3
- Concurrent Runs: 1
- Runs/Month: 100
- API Calls/Month: 1,000
- Storage: 5 GB
- Members: 1
- Artifacts/Run: 10
- Compute Minutes/Month: 60
- Retention: 7 days
- Rate Limit: 10/min

### Professional Tier
- Projects: 10
- Concurrent Runs: 3
- Runs/Month: 1,000
- API Calls/Month: 10,000
- Storage: 50 GB
- Members: 5
- Artifacts/Run: 50
- Compute Minutes/Month: 600
- Retention: 30 days
- Rate Limit: 60/min

### Team Tier
- Projects: 50
- Concurrent Runs: 10
- Runs/Month: 10,000
- API Calls/Month: 100,000
- Storage: 200 GB
- Members: 20
- Artifacts/Run: 200
- Compute Minutes/Month: 3,000
- Retention: 90 days
- Rate Limit: 300/min

### Enterprise Tier
- Projects: Unlimited (-1)
- Concurrent Runs: 50
- Runs/Month: Unlimited (-1)
- API Calls/Month: Unlimited (-1)
- Storage: 1,000 GB
- Members: Unlimited (-1)
- Artifacts/Run: 1,000
- Compute Minutes/Month: Unlimited (-1)
- Retention: 365 days
- Rate Limit: 1000/min

## Migration Execution

### Apply Migration
```bash
# Using Supabase CLI
supabase db push

# Or using SQL directly
psql $DATABASE_URL -f supabase/migrations/20251013000000_add_organizations.sql
```

### Rollback Migration
```bash
# Using SQL
psql $DATABASE_URL -f supabase/migrations/20251013000000_add_organizations_rollback.sql
```

## Testing Checklist

- [ ] Migration applies cleanly to empty database
- [ ] Migration applies cleanly to existing database with projects
- [ ] Rollback script removes all objects successfully
- [ ] Re-applying migration after rollback works
- [ ] New user registration creates default organization
- [ ] Organization slug validation works correctly
- [ ] Foreign key cascades work as expected
- [ ] RLS policies prevent unauthorized access
- [ ] Invitation system works end-to-end
- [ ] Usage tracking functions update correctly
- [ ] All indexes improve query performance
- [ ] Quota constraints are enforced
- [ ] Updated_at triggers fire correctly

## Integration Points

### TypeScript Types
Location: `/src/lib/organizations.types.ts`
- All TypeScript types align with database schema
- Enums match CHECK constraints exactly
- Type guards available for runtime validation

### API Endpoints (To Be Implemented)
Suggested routes:
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List user's organizations
- `GET /api/organizations/:id` - Get organization details
- `PATCH /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization
- `GET /api/organizations/:id/members` - List members
- `POST /api/organizations/:id/members` - Add member (via invite)
- `DELETE /api/organizations/:id/members/:userId` - Remove member
- `POST /api/organizations/:id/invites` - Create invite
- `POST /api/invites/accept` - Accept invite by token
- `GET /api/organizations/:id/quotas` - View quotas and usage

### Existing Project Integration
- Projects can now be assigned to organizations via `organization_id`
- All project queries should filter by organization_id for isolation
- Runs, steps, and artifacts inherit organization context from projects

## Security Considerations

1. **Data Isolation:** All queries filtered by organization membership
2. **Role-Based Access:** Granular permissions per role
3. **Invitation Security:** Cryptographically secure tokens
4. **Quota Enforcement:** Prevents resource exhaustion
5. **RLS Policies:** Database-level access control
6. **Cascade Deletes:** Proper cleanup on organization deletion
7. **Owner Protection:** Owners cannot leave without transferring ownership

## Performance Optimizations

1. **Comprehensive Indexing:** 17 indexes for common query patterns
2. **Efficient Joins:** Foreign keys enable optimal query planning
3. **JSONB for Settings:** Flexible storage with index support
4. **Usage Caching:** Last calculated timestamp prevents excessive recalculation
5. **Partial Indexes:** Conditional indexes for sparse columns

## Known Limitations

1. **Slug Format:** Limited to lowercase alphanumeric + hyphens (intentional)
2. **Single Owner:** Only one owner per organization (transferable)
3. **Invitation Expiry:** Fixed 7-day expiration (configurable via settings)
4. **Usage Updates:** Manual recalculation via function (consider cron job)
5. **No Soft Deletes:** Cascading deletes are permanent (backup recommended)

## Next Steps

1. **Phase 1:** Deploy migration to development environment
2. **Phase 2:** Implement TypeScript API layer
3. **Phase 3:** Add frontend UI components
4. **Phase 4:** Implement quota enforcement middleware
5. **Phase 5:** Add Stripe integration for billing
6. **Phase 6:** Create admin dashboard for quota management
7. **Phase 7:** Add audit logging for organization changes
8. **Phase 8:** Implement usage analytics and reporting

## Support & Documentation

- **Type Definitions:** `/src/lib/organizations.types.ts`
- **Architecture Docs:** `/src/lib/organizations.ARCHITECTURE.md`
- **Usage Examples:** `/src/lib/organizations.example.ts`
- **API Reference:** `/src/lib/organizations.README.md`

## Version History

- **v1.0.0** (2025-10-13): Initial migration with full organization multi-tenancy

---

**Generated by:** Claude Code (NOFX Control Plane Fullstack Developer)
**Migration Author:** Ben Finklea
**Review Status:** Ready for review
