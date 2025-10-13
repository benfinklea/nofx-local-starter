/**
 * BackplaneStore - Organization Management Store
 *
 * Comprehensive type-safe storage implementation for organization-based multi-tenancy.
 * Provides CRUD operations for organizations, member management, project associations,
 * workspace isolation, and quota management.
 *
 * @module backplane/store
 */

/* eslint-disable no-console -- console.log references are only in JSDoc example comments, not in actual code */

import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { getDatabase, type DatabaseOptions } from './database';
import type {
  Organization,
  OrganizationMember,
  OrganizationWithRole,
  OrganizationQuota,
  OrganizationWorkspace,
  OrganizationArtifact,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddOrganizationMemberInput,
} from './types';
import {
  OrganizationRole,
  SubscriptionPlan,
  SubscriptionStatus,
  IsolationLevel,
  getDefaultQuotas,
  getDefaultPermissions,
  isOrganizationRole,
  type ResourceUsage,
} from '../../lib/organizations.types';
import type { JsonValue } from '../../lib/store/types';

/**
 * Database row types
 * These types represent the raw structure from SQLite before deserialization.
 * JSON columns are stored as strings and need to be parsed.
 */
interface DatabaseOrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: string; // JSON
  quotas: string; // JSON
  usage: string; // JSON
  billing: string; // JSON
  metadata: string | null; // JSON
  created_at: string;
  updated_at: string;
}

interface DatabaseMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  permissions: string | null; // JSON
  permission_metadata: string | null; // JSON
  joined_at: string;
  updated_at: string;
}

interface DatabaseProjectRow {
  id: string;
  organization_id: string;
  name: string;
  repo_url: string | null;
  local_path: string | null;
  workspace_mode: string | null;
  default_branch: string | null;
  git_mode: string | null;
  initialized: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DatabaseWorkspaceRow {
  id: string;
  organization_id: string;
  project_id: string;
  path: string;
  isolation_level: string;
  metadata: string | null; // JSON
  created_at: string;
}

interface DatabaseArtifactRow {
  id: string;
  organization_id: string;
  run_id: string;
  step_id: string;
  type: string;
  path: string;
  size_bytes: number | null;
  mime_type: string | null;
  metadata: string | null; // JSON
  created_at: string;
}

interface DatabaseCountRow {
  count: number;
}

/**
 * BackplaneStore class for organization management
 *
 * Provides comprehensive organization management with type safety,
 * quota enforcement, and proper isolation.
 *
 * @example
 * ```typescript
 * const store = new BackplaneStore({ path: './data/backplane.db' });
 *
 * // Create organization
 * const org = store.createOrganization({
 *   name: 'Acme Corp',
 *   owner_id: 'user_123',
 * });
 *
 * // Add member
 * const member = store.addOrganizationMember({
 *   organization_id: org.id,
 *   user_id: 'user_456',
 *   role: OrganizationRole.MEMBER,
 * });
 * ```
 */
export class BackplaneStore {
  private db: Database.Database;

  /**
   * Create a new BackplaneStore instance
   *
   * @param options - Database configuration options
   */
  constructor(options: DatabaseOptions = {}) {
    this.db = getDatabase(options);
  }

  // ============================================================================
  // Organization CRUD Operations
  // ============================================================================

  /**
   * Create a new organization
   *
   * Automatically:
   * - Generates unique ID and slug
   * - Sets default quotas based on plan
   * - Initializes usage counters
   * - Adds owner as first member
   *
   * @param input - Organization creation data
   * @returns Created organization
   * @throws Error if slug is invalid or duplicate
   *
   * @example
   * ```typescript
   * const org = store.createOrganization({
   *   name: 'Acme Corporation',
   *   owner_id: 'user_123',
   *   plan: SubscriptionPlan.PROFESSIONAL,
   * });
   * ```
   */
  createOrganization(input: CreateOrganizationInput): Organization {
    const id = `org_${this.generateId()}`;
    const slug = input.slug || this.generateSlug(input.name);
    const now = new Date().toISOString();
    const plan = input.plan || SubscriptionPlan.FREE;

    // Validate slug format
    this.validateSlug(slug);

    // Check for duplicate slug
    const existing = this.getOrganizationBySlug(slug);
    if (existing) {
      throw new Error(`Organization slug "${slug}" is already in use`);
    }

    const quotas = getDefaultQuotas(plan);
    const usage: ResourceUsage = {
      projects_count: 0,
      concurrent_runs_count: 0,
      runs_this_month: 0,
      api_calls_this_month: 0,
      storage_used_gb: 0,
      members_count: 1, // Owner is first member
      artifacts_count: 0,
      compute_minutes_this_month: 0,
      last_calculated_at: now,
    };

    const org: Organization = {
      id,
      name: input.name,
      slug,
      owner_id: input.owner_id,
      settings: {
        isolation_level: IsolationLevel.STANDARD,
        ...input.settings,
      },
      quotas,
      usage,
      billing: {
        plan,
        status: SubscriptionStatus.ACTIVE,
      },
      metadata: input.metadata as JsonValue | undefined,
      created_at: now,
      updated_at: now,
    };

    // Insert organization
    const stmt = this.db.prepare(`
      INSERT INTO organizations (
        id, name, slug, owner_id, settings, quotas, usage, billing, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      org.id,
      org.name,
      org.slug,
      org.owner_id,
      JSON.stringify(org.settings),
      JSON.stringify(org.quotas),
      JSON.stringify(org.usage),
      JSON.stringify(org.billing),
      org.metadata ? JSON.stringify(org.metadata) : null,
      org.created_at,
      org.updated_at
    );

    // Add owner as first member
    this.addOrganizationMember({
      organization_id: org.id,
      user_id: org.owner_id,
      role: OrganizationRole.OWNER,
    });

    return org;
  }

  /**
   * Get organization by ID
   *
   * @param id - Organization ID
   * @returns Organization or null if not found
   *
   * @example
   * ```typescript
   * const org = store.getOrganization('org_abc123');
   * if (org) {
   *   console.log(org.name);
   * }
   * ```
   */
  getOrganization(id: string): Organization | null {
    const stmt = this.db.prepare('SELECT * FROM organizations WHERE id = ?');
    const row = stmt.get(id) as DatabaseOrganizationRow | undefined;

    if (!row) {
      return null;
    }

    return this.deserializeOrganization(row);
  }

  /**
   * Get organization by slug
   *
   * @param slug - Organization slug
   * @returns Organization or null if not found
   *
   * @example
   * ```typescript
   * const org = store.getOrganizationBySlug('acme-corp');
   * ```
   */
  getOrganizationBySlug(slug: string): Organization | null {
    const stmt = this.db.prepare('SELECT * FROM organizations WHERE slug = ?');
    const row = stmt.get(slug) as DatabaseOrganizationRow | undefined;

    if (!row) {
      return null;
    }

    return this.deserializeOrganization(row);
  }

  /**
   * Update organization
   *
   * Merges settings and updates timestamp.
   *
   * @param id - Organization ID
   * @param input - Update data
   * @returns Updated organization
   * @throws Error if organization not found or slug is invalid/duplicate
   *
   * @example
   * ```typescript
   * const updated = store.updateOrganization('org_abc', {
   *   name: 'New Name',
   *   settings: { isolation_level: IsolationLevel.STRICT },
   * });
   * ```
   */
  updateOrganization(id: string, input: UpdateOrganizationInput): Organization {
    const org = this.getOrganization(id);
    if (!org) {
      throw new Error(`Organization with ID "${id}" not found`);
    }

    // Validate slug if provided
    if (input.slug !== undefined) {
      this.validateSlug(input.slug);

      // Check for duplicate slug (excluding current org)
      const existing = this.getOrganizationBySlug(input.slug);
      if (existing && existing.id !== id) {
        throw new Error(`Organization slug "${input.slug}" is already in use`);
      }
    }

    // Merge settings
    const settings = {
      ...org.settings,
      ...input.settings,
      features: {
        ...org.settings.features,
        ...input.settings?.features,
      },
    };

    const updated: Organization = {
      ...org,
      name: input.name ?? org.name,
      slug: input.slug ?? org.slug,
      settings,
      metadata: input.metadata !== undefined ? (input.metadata as JsonValue | undefined) : org.metadata,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE organizations
      SET name = ?, slug = ?, settings = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.name,
      updated.slug,
      JSON.stringify(updated.settings),
      updated.metadata ? JSON.stringify(updated.metadata) : null,
      updated.updated_at,
      id
    );

    return updated;
  }

  /**
   * Delete organization
   *
   * Prevents deletion if organization has projects (unless forced).
   * Cascade deletes members.
   *
   * @param id - Organization ID
   * @param options - Delete options
   * @returns true if deleted, false if not found
   * @throws Error if organization has projects and force is not true
   *
   * @example
   * ```typescript
   * // Safe delete (fails if has projects)
   * store.deleteOrganization('org_abc');
   *
   * // Force delete
   * store.deleteOrganization('org_abc', { force: true });
   * ```
   */
  deleteOrganization(id: string, options?: { force?: boolean }): boolean {
    const org = this.getOrganization(id);
    if (!org) {
      return false;
    }

    // Check for projects
    const projects = this.getOrganizationProjects(id);
    if (projects.length > 0 && !options?.force) {
      throw new Error(
        `Cannot delete organization "${org.name}": it has ${projects.length} associated project(s). Use force option to delete anyway.`
      );
    }

    // Delete organization (cascade will delete members)
    const stmt = this.db.prepare('DELETE FROM organizations WHERE id = ?');
    stmt.run(id);

    return true;
  }

  // ============================================================================
  // Member Management
  // ============================================================================

  /**
   * Add a member to an organization
   *
   * Automatically assigns default permissions based on role.
   * Checks member quota before adding.
   *
   * @param input - Member addition data
   * @returns Created member record
   * @throws Error if quota exceeded, user already a member, or organization not found
   *
   * @example
   * ```typescript
   * const member = store.addOrganizationMember({
   *   organization_id: 'org_abc',
   *   user_id: 'user_123',
   *   role: OrganizationRole.MEMBER,
   * });
   * ```
   */
  addOrganizationMember(input: AddOrganizationMemberInput): OrganizationMember {
    const org = this.getOrganization(input.organization_id);
    if (!org) {
      throw new Error(`Organization with ID "${input.organization_id}" not found`);
    }

    // Validate role
    if (!isOrganizationRole(input.role)) {
      throw new Error(`Invalid role: "${input.role}"`);
    }

    // Check if user is already a member
    const existingMember = this.getMember(input.organization_id, input.user_id);
    if (existingMember) {
      throw new Error(
        `User "${input.user_id}" is already a member of organization "${org.name}"`
      );
    }

    // Check member quota
    if (!this.checkMemberQuota(input.organization_id)) {
      throw new Error(
        `Cannot add member: organization "${org.name}" has reached its member quota of ${org.quotas.max_members}`
      );
    }

    const id = `mem_${this.generateId()}`;
    const now = new Date().toISOString();
    const permissions = input.permissions || getDefaultPermissions(input.role);

    const member: OrganizationMember = {
      id,
      organization_id: input.organization_id,
      user_id: input.user_id,
      role: input.role,
      permissions,
      joined_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO organization_members (
        id, organization_id, user_id, role, permissions, joined_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      member.id,
      member.organization_id,
      member.user_id,
      member.role,
      JSON.stringify(member.permissions),
      member.joined_at,
      member.updated_at
    );

    // Increment member count
    this.updateUsageCount(input.organization_id, 'members_count', 1);

    return member;
  }

  /**
   * Remove a member from an organization
   *
   * Cannot remove the organization owner.
   *
   * @param orgId - Organization ID
   * @param userId - User ID to remove
   * @returns true if removed, false if not found
   * @throws Error if attempting to remove owner
   *
   * @example
   * ```typescript
   * store.removeOrganizationMember('org_abc', 'user_123');
   * ```
   */
  removeOrganizationMember(orgId: string, userId: string): boolean {
    const org = this.getOrganization(orgId);
    if (!org) {
      return false;
    }

    const member = this.getMember(orgId, userId);
    if (!member) {
      return false;
    }

    // Cannot remove owner
    if (userId === org.owner_id) {
      throw new Error(`Cannot remove owner from organization "${org.name}"`);
    }

    const stmt = this.db.prepare(
      'DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?'
    );
    const result = stmt.run(orgId, userId);

    if (result.changes > 0) {
      // Decrement member count
      this.updateUsageCount(orgId, 'members_count', -1);
      return true;
    }

    return false;
  }

  /**
   * Get all members of an organization
   *
   * @param orgId - Organization ID
   * @returns Array of members (empty if organization not found)
   *
   * @example
   * ```typescript
   * const members = store.getOrganizationMembers('org_abc');
   * members.forEach(m => console.log(m.user_id, m.role));
   * ```
   */
  getOrganizationMembers(orgId: string): OrganizationMember[] {
    const stmt = this.db.prepare(
      'SELECT * FROM organization_members WHERE organization_id = ?'
    );
    const rows = stmt.all(orgId) as DatabaseMemberRow[];

    return rows.map((row) => this.deserializeMember(row));
  }

  /**
   * Update a member's role
   *
   * Cannot change the owner's role.
   * Updates permissions to match new role.
   *
   * @param orgId - Organization ID
   * @param userId - User ID
   * @param role - New role
   * @returns Updated member
   * @throws Error if member not found, role invalid, or attempting to change owner
   *
   * @example
   * ```typescript
   * const updated = store.updateMemberRole(
   *   'org_abc',
   *   'user_123',
   *   OrganizationRole.ADMIN
   * );
   * ```
   */
  updateMemberRole(
    orgId: string,
    userId: string,
    role: OrganizationRole
  ): OrganizationMember {
    const org = this.getOrganization(orgId);
    if (!org) {
      throw new Error(`Organization with ID "${orgId}" not found`);
    }

    const member = this.getMember(orgId, userId);
    if (!member) {
      throw new Error(
        `Member with user ID "${userId}" not found in organization "${org.name}"`
      );
    }

    // Cannot change owner role
    if (userId === org.owner_id) {
      throw new Error(`Cannot change owner role in organization "${org.name}"`);
    }

    // Validate role
    if (!isOrganizationRole(role)) {
      throw new Error(`Invalid role: "${role}"`);
    }

    const now = new Date().toISOString();
    const permissions = getDefaultPermissions(role);

    const stmt = this.db.prepare(`
      UPDATE organization_members
      SET role = ?, permissions = ?, updated_at = ?
      WHERE organization_id = ? AND user_id = ?
    `);

    stmt.run(role, JSON.stringify(permissions), now, orgId, userId);

    return {
      ...member,
      role,
      permissions,
      updated_at: now,
    };
  }

  /**
   * Get all organizations a user is a member of
   *
   * Returns organizations with the user's role included.
   *
   * @param userId - User ID
   * @returns Array of organizations with user roles
   *
   * @example
   * ```typescript
   * const userOrgs = store.getUserOrganizations('user_123');
   * userOrgs.forEach(org => {
   *   console.log(org.name, org.user_role);
   * });
   * ```
   */
  getUserOrganizations(userId: string): OrganizationWithRole[] {
    const stmt = this.db.prepare(`
      SELECT o.*, m.role as user_role
      FROM organizations o
      INNER JOIN organization_members m ON o.id = m.organization_id
      WHERE m.user_id = ?
    `);

    const rows = stmt.all(userId) as (DatabaseOrganizationRow & { user_role: string })[];

    return rows.map((row) => {
      const org = this.deserializeOrganization(row);
      return {
        ...org,
        user_role: row.user_role as OrganizationRole,
      };
    });
  }

  // ============================================================================
  // Project Association
  // ============================================================================

  /**
   * Associate a project with an organization
   *
   * Checks project quota before associating.
   *
   * @param projectId - Project ID
   * @param orgId - Organization ID
   * @returns true if associated
   * @throws Error if quota exceeded, already associated, or organization not found
   *
   * @example
   * ```typescript
   * store.associateProjectWithOrganization('proj_123', 'org_abc');
   * ```
   */
  associateProjectWithOrganization(projectId: string, orgId: string): boolean {
    const org = this.getOrganization(orgId);
    if (!org) {
      throw new Error(`Organization with ID "${orgId}" not found`);
    }

    // Check if already associated
    const existing = this.getProject(projectId);
    if (existing) {
      throw new Error(
        `Project "${projectId}" is already associated with organization "${existing.organization_id}"`
      );
    }

    // Check project quota
    if (!this.checkProjectQuota(orgId)) {
      throw new Error(
        `Cannot associate project: organization "${org.name}" has reached its project quota of ${org.quotas.max_projects}`
      );
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, organization_id, name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(projectId, orgId, `Project ${projectId}`, now, now);

    // Increment project count
    this.incrementProjectCount(orgId);

    return true;
  }

  /**
   * Disassociate a project from its organization
   *
   * @param projectId - Project ID
   * @returns true if disassociated, false if not found
   *
   * @example
   * ```typescript
   * store.disassociateProjectFromOrganization('proj_123');
   * ```
   */
  disassociateProjectFromOrganization(projectId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) {
      return false;
    }

    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(projectId);

    if (result.changes > 0) {
      // Decrement project count
      this.decrementProjectCount(project.organization_id);
      return true;
    }

    return false;
  }

  /**
   * Get all projects for an organization
   *
   * @param orgId - Organization ID
   * @returns Array of projects
   *
   * @example
   * ```typescript
   * const projects = store.getOrganizationProjects('org_abc');
   * ```
   */
  getOrganizationProjects(orgId: string): DatabaseProjectRow[] {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE organization_id = ?');
    return stmt.all(orgId) as DatabaseProjectRow[];
  }

  // ============================================================================
  // Workspace Isolation
  // ============================================================================

  /**
   * Get all workspaces for an organization
   *
   * @param orgId - Organization ID
   * @returns Array of workspaces
   *
   * @example
   * ```typescript
   * const workspaces = store.getOrganizationWorkspaces('org_abc');
   * ```
   */
  getOrganizationWorkspaces(orgId: string): OrganizationWorkspace[] {
    const stmt = this.db.prepare('SELECT * FROM workspaces WHERE organization_id = ?');
    const rows = stmt.all(orgId) as DatabaseWorkspaceRow[];

    return rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      path: row.path,
      isolation_level: row.isolation_level as IsolationLevel,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
    }));
  }

  /**
   * Check if a user has access to a workspace
   *
   * User has access if they are a member of the workspace's organization.
   *
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns true if user has access
   *
   * @example
   * ```typescript
   * if (store.userHasWorkspaceAccess('user_123', 'ws_abc')) {
   *   // Allow access
   * }
   * ```
   */
  userHasWorkspaceAccess(userId: string, workspaceId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM workspaces w
      INNER JOIN organization_members m ON w.organization_id = m.organization_id
      WHERE w.id = ? AND m.user_id = ?
    `);

    const result = stmt.get(workspaceId, userId) as DatabaseCountRow | undefined;
    return result ? result.count > 0 : false;
  }

  /**
   * Get all artifacts for an organization
   *
   * @param orgId - Organization ID
   * @returns Array of artifacts
   *
   * @example
   * ```typescript
   * const artifacts = store.getOrganizationArtifacts('org_abc');
   * ```
   */
  getOrganizationArtifacts(orgId: string): OrganizationArtifact[] {
    const stmt = this.db.prepare('SELECT * FROM artifacts WHERE organization_id = ?');
    const rows = stmt.all(orgId) as DatabaseArtifactRow[];

    return rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      run_id: row.run_id,
      step_id: row.step_id,
      type: row.type,
      path: row.path,
      size_bytes: row.size_bytes ?? undefined,
      mime_type: row.mime_type ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
    }));
  }

  // ============================================================================
  // Quota Management
  // ============================================================================

  /**
   * Get quota information for an organization
   *
   * @param orgId - Organization ID
   * @returns Quota information
   * @throws Error if organization not found
   *
   * @example
   * ```typescript
   * const quota = store.getOrganizationQuota('org_abc');
   * console.log(`Projects: ${quota.usage.projects_count}/${quota.quotas.max_projects}`);
   * ```
   */
  getOrganizationQuota(orgId: string): OrganizationQuota {
    const org = this.getOrganization(orgId);
    if (!org) {
      throw new Error(`Organization with ID "${orgId}" not found`);
    }

    return {
      organization_id: orgId,
      quotas: org.quotas,
      usage: org.usage,
    };
  }

  /**
   * Check if organization can add a project
   *
   * @param orgId - Organization ID
   * @returns true if under quota, false if at/over quota
   *
   * @example
   * ```typescript
   * if (store.checkProjectQuota('org_abc')) {
   *   // Can add project
   * }
   * ```
   */
  checkProjectQuota(orgId: string): boolean {
    const org = this.getOrganization(orgId);
    if (!org) {
      return false;
    }

    // Unlimited quota
    if (org.quotas.max_projects === -1) {
      return true;
    }

    return org.usage.projects_count < org.quotas.max_projects;
  }

  /**
   * Check if organization can add a workspace
   *
   * @param orgId - Organization ID
   * @returns true if under quota
   *
   * @example
   * ```typescript
   * if (store.checkWorkspaceQuota('org_abc')) {
   *   // Can add workspace
   * }
   * ```
   */
  checkWorkspaceQuota(orgId: string): boolean {
    // Workspaces are tied to projects, so use project quota
    return this.checkProjectQuota(orgId);
  }

  /**
   * Check if organization can add a member
   *
   * @param orgId - Organization ID
   * @returns true if under quota, false if at/over quota
   *
   * @example
   * ```typescript
   * if (store.checkMemberQuota('org_abc')) {
   *   // Can add member
   * }
   * ```
   */
  checkMemberQuota(orgId: string): boolean {
    const org = this.getOrganization(orgId);
    if (!org) {
      return false;
    }

    // Unlimited quota
    if (org.quotas.max_members === -1) {
      return true;
    }

    return org.usage.members_count < org.quotas.max_members;
  }

  /**
   * Check if organization can add storage
   *
   * @param orgId - Organization ID
   * @param additionalBytes - Additional bytes to add
   * @returns true if under quota after addition
   *
   * @example
   * ```typescript
   * if (store.checkStorageQuota('org_abc', 1024 * 1024 * 100)) {
   *   // Can add 100 MB
   * }
   * ```
   */
  checkStorageQuota(orgId: string, additionalBytes: number): boolean {
    const org = this.getOrganization(orgId);
    if (!org) {
      return false;
    }

    // Unlimited quota
    if (org.quotas.max_storage_gb === -1) {
      return true;
    }

    const additionalGb = additionalBytes / (1024 * 1024 * 1024);
    const totalGb = org.usage.storage_used_gb + additionalGb;

    return totalGb <= org.quotas.max_storage_gb;
  }

  /**
   * Increment project count for an organization
   *
   * @param orgId - Organization ID
   *
   * @example
   * ```typescript
   * store.incrementProjectCount('org_abc');
   * ```
   */
  incrementProjectCount(orgId: string): void {
    this.updateUsageCount(orgId, 'projects_count', 1);
  }

  /**
   * Decrement project count for an organization
   *
   * @param orgId - Organization ID
   *
   * @example
   * ```typescript
   * store.decrementProjectCount('org_abc');
   * ```
   */
  decrementProjectCount(orgId: string): void {
    this.updateUsageCount(orgId, 'projects_count', -1);
  }

  /**
   * Add storage usage to an organization
   *
   * @param orgId - Organization ID
   * @param bytes - Bytes to add
   *
   * @example
   * ```typescript
   * store.addStorageUsage('org_abc', 1024 * 1024 * 100); // 100 MB
   * ```
   */
  addStorageUsage(orgId: string, bytes: number): void {
    const org = this.getOrganization(orgId);
    if (!org) {
      return;
    }

    const gb = bytes / (1024 * 1024 * 1024);
    const newUsage = org.usage.storage_used_gb + gb;

    this.updateUsageField(orgId, 'storage_used_gb', newUsage);
  }

  /**
   * Subtract storage usage from an organization
   *
   * @param orgId - Organization ID
   * @param bytes - Bytes to subtract
   *
   * @example
   * ```typescript
   * store.subtractStorageUsage('org_abc', 1024 * 1024 * 100); // 100 MB
   * ```
   */
  subtractStorageUsage(orgId: string, bytes: number): void {
    const org = this.getOrganization(orgId);
    if (!org) {
      return;
    }

    const gb = bytes / (1024 * 1024 * 1024);
    const newUsage = Math.max(0, org.usage.storage_used_gb - gb);

    this.updateUsageField(orgId, 'storage_used_gb', newUsage);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return randomBytes(12).toString('hex');
  }

  /**
   * Generate a URL-safe slug from a name
   */
  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check for uniqueness
    let slug = baseSlug;
    let counter = 1;

    while (this.getOrganizationBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Validate slug format
   */
  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(
        `Invalid slug format: "${slug}". Slug must contain only lowercase letters, numbers, and hyphens.`
      );
    }

    if (slug.length < 2) {
      throw new Error('Slug must be at least 2 characters long');
    }

    if (slug.length > 64) {
      throw new Error('Slug must be at most 64 characters long');
    }
  }

  /**
   * Deserialize organization from database row
   */
  private deserializeOrganization(row: DatabaseOrganizationRow): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      owner_id: row.owner_id,
      settings: JSON.parse(row.settings),
      quotas: JSON.parse(row.quotas),
      usage: JSON.parse(row.usage),
      billing: JSON.parse(row.billing),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Deserialize member from database row
   */
  private deserializeMember(row: DatabaseMemberRow): OrganizationMember {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      role: row.role as OrganizationRole,
      permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
      permission_metadata: row.permission_metadata
        ? JSON.parse(row.permission_metadata)
        : undefined,
      joined_at: row.joined_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get a single member
   */
  private getMember(orgId: string, userId: string): OrganizationMember | null {
    const stmt = this.db.prepare(
      'SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?'
    );
    const row = stmt.get(orgId, userId) as DatabaseMemberRow | undefined;

    if (!row) {
      return null;
    }

    return this.deserializeMember(row);
  }

  /**
   * Get a single project
   */
  private getProject(projectId: string): DatabaseProjectRow | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(projectId) as DatabaseProjectRow | undefined;
    return row ?? null;
  }

  /**
   * Update a usage count field
   */
  private updateUsageCount(orgId: string, field: keyof ResourceUsage, delta: number): void {
    const org = this.getOrganization(orgId);
    if (!org) {
      return;
    }

    const currentValue = org.usage[field] as number;
    const newValue = Math.max(0, currentValue + delta);

    this.updateUsageField(orgId, field, newValue);
  }

  /**
   * Update a usage field
   */
  private updateUsageField(
    orgId: string,
    field: keyof ResourceUsage,
    value: number | string
  ): void {
    const org = this.getOrganization(orgId);
    if (!org) {
      return;
    }

    const updatedUsage = {
      ...org.usage,
      [field]: value,
      last_calculated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare('UPDATE organizations SET usage = ?, updated_at = ? WHERE id = ?');
    stmt.run(JSON.stringify(updatedUsage), new Date().toISOString(), orgId);
  }
}
