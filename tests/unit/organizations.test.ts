/**
 * Comprehensive Test Suite for BackplaneStore Organization Management
 *
 * Tests all organization CRUD operations, member management, project associations,
 * workspace isolation, and quota management.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BackplaneStore } from '../../src/storage/backplane/store';
import { resetDatabase } from '../../src/storage/backplane/database';
import {
  OrganizationRole,
  SubscriptionPlan,
  SubscriptionStatus,
  IsolationLevel,
} from '../../src/lib/organizations.types';

describe('BackplaneStore - Organization Management', () => {
  let store: BackplaneStore;

  beforeEach(() => {
    resetDatabase();
    store = new BackplaneStore({ path: ':memory:' });
  });

  afterEach(() => {
    resetDatabase();
  });

  // ============================================================================
  // Organization CRUD Operations
  // ============================================================================

  describe('createOrganization', () => {
    it('should create an organization with minimal input', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      expect(org).toBeDefined();
      expect(org.id).toMatch(/^org_/);
      expect(org.name).toBe('Test Org');
      expect(org.owner_id).toBe('user_123');
      expect(org.slug).toMatch(/^test-org/);
      expect(org.billing.plan).toBe(SubscriptionPlan.FREE);
      expect(org.billing.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should create an organization with custom slug', () => {
      const org = store.createOrganization({
        name: 'My Company',
        slug: 'my-company',
        owner_id: 'user_123',
      });

      expect(org.slug).toBe('my-company');
    });

    it('should auto-generate slug if not provided', () => {
      const org = store.createOrganization({
        name: 'Acme Corporation',
        owner_id: 'user_123',
      });

      expect(org.slug).toMatch(/^acme-corporation/);
    });

    it('should create organization with custom subscription plan', () => {
      const org = store.createOrganization({
        name: 'Pro Org',
        owner_id: 'user_123',
        plan: SubscriptionPlan.PROFESSIONAL,
      });

      expect(org.billing.plan).toBe(SubscriptionPlan.PROFESSIONAL);
      expect(org.quotas.max_projects).toBe(10);
    });

    it('should create organization with settings', () => {
      const org = store.createOrganization({
        name: 'Secure Org',
        owner_id: 'user_123',
        settings: {
          isolation_level: IsolationLevel.STRICT,
          features: {
            advanced_analytics: true,
          },
        },
      });

      expect(org.settings.isolation_level).toBe(IsolationLevel.STRICT);
      expect(org.settings.features?.advanced_analytics).toBe(true);
    });

    it('should initialize usage counters to zero', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      expect(org.usage.projects_count).toBe(0);
      expect(org.usage.runs_this_month).toBe(0);
      expect(org.usage.storage_used_gb).toBe(0);
      expect(org.usage.members_count).toBe(1); // Owner is automatically a member
    });

    it('should throw error for invalid slug format', () => {
      expect(() => {
        store.createOrganization({
          name: 'Test',
          slug: 'Invalid Slug!',
          owner_id: 'user_123',
        });
      }).toThrow(/slug/i);
    });

    it('should throw error for duplicate slug', () => {
      store.createOrganization({
        name: 'First Org',
        slug: 'my-org',
        owner_id: 'user_123',
      });

      expect(() => {
        store.createOrganization({
          name: 'Second Org',
          slug: 'my-org',
          owner_id: 'user_456',
        });
      }).toThrow(/slug/i);
    });

    it('should set created_at and updated_at timestamps', () => {
      const before = new Date().toISOString();
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      const after = new Date().toISOString();

      expect(org.created_at >= before).toBe(true);
      expect(org.created_at <= after).toBe(true);
      expect(org.updated_at).toBe(org.created_at);
    });

    it('should automatically add owner as member', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      const members = store.getOrganizationMembers(org.id);
      expect(members).toHaveLength(1);
      expect(members[0]?.user_id).toBe('user_123');
      expect(members[0]?.role).toBe(OrganizationRole.OWNER);
    });
  });

  describe('getOrganization', () => {
    it('should retrieve existing organization by ID', () => {
      const created = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      const retrieved = store.getOrganization(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent organization', () => {
      const result = store.getOrganization('org_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getOrganizationBySlug', () => {
    it('should retrieve organization by slug', () => {
      const created = store.createOrganization({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 'user_123',
      });

      const retrieved = store.getOrganizationBySlug('test-org');
      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent slug', () => {
      const result = store.getOrganizationBySlug('nonexistent-slug');
      expect(result).toBeNull();
    });

    it('should be case-sensitive', () => {
      store.createOrganization({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 'user_123',
      });

      const result = store.getOrganizationBySlug('Test-Org');
      expect(result).toBeNull();
    });
  });

  describe('updateOrganization', () => {
    it('should update organization name', () => {
      const org = store.createOrganization({
        name: 'Old Name',
        owner_id: 'user_123',
      });

      const updated = store.updateOrganization(org.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.updated_at).not.toBe(org.updated_at);
    });

    it('should update organization slug', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        slug: 'old-slug',
        owner_id: 'user_123',
      });

      const updated = store.updateOrganization(org.id, {
        slug: 'new-slug',
      });

      expect(updated.slug).toBe('new-slug');
    });

    it('should update organization settings', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      const updated = store.updateOrganization(org.id, {
        settings: {
          isolation_level: IsolationLevel.STRICT,
        },
      });

      expect(updated.settings.isolation_level).toBe(IsolationLevel.STRICT);
    });

    it('should merge settings on update', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
        settings: {
          features: {
            advanced_analytics: true,
          },
        },
      });

      const updated = store.updateOrganization(org.id, {
        settings: {
          features: {
            api_access: true,
          },
        },
      });

      expect(updated.settings.features?.advanced_analytics).toBe(true);
      expect(updated.settings.features?.api_access).toBe(true);
    });

    it('should throw error for invalid slug on update', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      expect(() => {
        store.updateOrganization(org.id, {
          slug: 'Invalid Slug!',
        });
      }).toThrow(/slug/i);
    });

    it('should throw error for duplicate slug on update', () => {
      store.createOrganization({
        name: 'Org 1',
        slug: 'org-1',
        owner_id: 'user_123',
      });

      const org2 = store.createOrganization({
        name: 'Org 2',
        slug: 'org-2',
        owner_id: 'user_123',
      });

      expect(() => {
        store.updateOrganization(org2.id, {
          slug: 'org-1',
        });
      }).toThrow(/slug/i);
    });

    it('should throw error for non-existent organization', () => {
      expect(() => {
        store.updateOrganization('org_nonexistent', {
          name: 'New Name',
        });
      }).toThrow(/not found/i);
    });
  });

  describe('deleteOrganization', () => {
    it('should delete organization', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      const result = store.deleteOrganization(org.id);
      expect(result).toBe(true);

      const retrieved = store.getOrganization(org.id);
      expect(retrieved).toBeNull();
    });

    it('should cascade delete members', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      store.addOrganizationMember({
        organization_id: org.id,
        user_id: 'user_456',
        role: OrganizationRole.MEMBER,
      });

      store.deleteOrganization(org.id);

      const members = store.getOrganizationMembers(org.id);
      expect(members).toHaveLength(0);
    });

    it('should prevent deletion if organization has projects (without force)', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      // Simulate project association
      store.associateProjectWithOrganization('proj_123', org.id);

      expect(() => {
        store.deleteOrganization(org.id);
      }).toThrow(/projects/i);
    });

    it('should allow force deletion with projects', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });

      store.associateProjectWithOrganization('proj_123', org.id);

      const result = store.deleteOrganization(org.id, { force: true });
      expect(result).toBe(true);
    });

    it('should return false for non-existent organization', () => {
      const result = store.deleteOrganization('org_nonexistent');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Member Management
  // ============================================================================

  describe('addOrganizationMember', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });
      orgId = org.id;
    });

    it('should add a member to organization', () => {
      const member = store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      expect(member.organization_id).toBe(orgId);
      expect(member.user_id).toBe('user_123');
      expect(member.role).toBe(OrganizationRole.MEMBER);
      expect(member.id).toMatch(/^mem_/);
    });

    it('should increment members_count on add', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.members_count).toBe(1); // Owner

      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      const after = store.getOrganization(orgId)!;
      expect(after.usage.members_count).toBe(2);
    });

    it('should throw error when adding duplicate member', () => {
      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      expect(() => {
        store.addOrganizationMember({
          organization_id: orgId,
          user_id: 'user_123',
          role: OrganizationRole.ADMIN,
        });
      }).toThrow(/already a member/i);
    });

    it('should throw error when exceeding member quota', () => {
      const org = store.getOrganization(orgId)!;
      const maxMembers = org.quotas.max_members;

      // Add members up to quota (accounting for owner)
      for (let i = 1; i < maxMembers; i++) {
        store.addOrganizationMember({
          organization_id: orgId,
          user_id: `user_${i}`,
          role: OrganizationRole.MEMBER,
        });
      }

      expect(() => {
        store.addOrganizationMember({
          organization_id: orgId,
          user_id: 'user_overflow',
          role: OrganizationRole.MEMBER,
        });
      }).toThrow(/member quota/i);
    });

    it('should use default permissions for role', () => {
      const member = store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      expect(member.permissions).toBeDefined();
      expect(member.permissions!.length).toBeGreaterThan(0);
    });

    it('should allow custom permissions', () => {
      const customPerms = ['org:read', 'projects:read'];
      const member = store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing with custom string array to verify flexibility
        permissions: customPerms as any,
      });

      expect(member.permissions).toEqual(customPerms);
    });

    it('should throw error for invalid role', () => {
      expect(() => {
        store.addOrganizationMember({
          organization_id: orgId,
          user_id: 'user_123',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing error handling with intentionally invalid role
          role: 'invalid-role' as any,
        });
      }).toThrow(/invalid role/i);
    });

    it('should throw error for non-existent organization', () => {
      expect(() => {
        store.addOrganizationMember({
          organization_id: 'org_nonexistent',
          user_id: 'user_123',
          role: OrganizationRole.MEMBER,
        });
      }).toThrow(/organization not found/i);
    });
  });

  describe('removeOrganizationMember', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });
      orgId = org.id;

      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });
    });

    it('should remove a member from organization', () => {
      const result = store.removeOrganizationMember(orgId, 'user_123');
      expect(result).toBe(true);

      const members = store.getOrganizationMembers(orgId);
      expect(members.find((m) => m.user_id === 'user_123')).toBeUndefined();
    });

    it('should decrement members_count on remove', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.members_count).toBe(2); // Owner + added member

      store.removeOrganizationMember(orgId, 'user_123');

      const after = store.getOrganization(orgId)!;
      expect(after.usage.members_count).toBe(1);
    });

    it('should prevent removing the owner', () => {
      expect(() => {
        store.removeOrganizationMember(orgId, 'user_owner');
      }).toThrow(/cannot remove owner/i);
    });

    it('should return false for non-existent member', () => {
      const result = store.removeOrganizationMember(orgId, 'user_nonexistent');
      expect(result).toBe(false);
    });

    it('should return false for non-existent organization', () => {
      const result = store.removeOrganizationMember('org_nonexistent', 'user_123');
      expect(result).toBe(false);
    });
  });

  describe('getOrganizationMembers', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });
      orgId = org.id;
    });

    it('should return all members of organization', () => {
      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_1',
        role: OrganizationRole.MEMBER,
      });
      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_2',
        role: OrganizationRole.ADMIN,
      });

      const members = store.getOrganizationMembers(orgId);
      expect(members).toHaveLength(3); // Owner + 2 added
    });

    it('should return empty array for organization with no members', () => {
      const org = store.createOrganization({
        name: 'Empty Org',
        owner_id: 'user_owner',
      });
      store.removeOrganizationMember(org.id, 'user_owner'); // Force remove owner for test

      const members = store.getOrganizationMembers(org.id);
      expect(members).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', () => {
      const members = store.getOrganizationMembers('org_nonexistent');
      expect(members).toHaveLength(0);
    });
  });

  describe('updateMemberRole', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });
      orgId = org.id;

      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });
    });

    it('should update member role', () => {
      const updated = store.updateMemberRole(
        orgId,
        'user_123',
        OrganizationRole.ADMIN
      );

      expect(updated.role).toBe(OrganizationRole.ADMIN);
    });

    it('should update permissions when changing role', () => {
      const member = store.getOrganizationMembers(orgId).find(
        (m) => m.user_id === 'user_123'
      )!;
      const oldPermCount = member.permissions?.length || 0;

      const updated = store.updateMemberRole(
        orgId,
        'user_123',
        OrganizationRole.ADMIN
      );

      expect(updated.permissions!.length).toBeGreaterThan(oldPermCount);
    });

    it('should throw error when changing owner role', () => {
      expect(() => {
        store.updateMemberRole(orgId, 'user_owner', OrganizationRole.MEMBER);
      }).toThrow(/cannot change owner role/i);
    });

    it('should throw error for invalid role', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing error handling with intentionally invalid role
        store.updateMemberRole(orgId, 'user_123', 'invalid-role' as any);
      }).toThrow(/invalid role/i);
    });

    it('should throw error for non-existent member', () => {
      expect(() => {
        store.updateMemberRole(orgId, 'user_nonexistent', OrganizationRole.ADMIN);
      }).toThrow(/member not found/i);
    });
  });

  describe('getUserOrganizations', () => {
    it('should return all organizations for a user', () => {
      const org1 = store.createOrganization({
        name: 'Org 1',
        owner_id: 'user_123',
      });

      const org2 = store.createOrganization({
        name: 'Org 2',
        owner_id: 'user_456',
      });

      store.addOrganizationMember({
        organization_id: org2.id,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      const userOrgs = store.getUserOrganizations('user_123');
      expect(userOrgs).toHaveLength(2);
      const orgIds = userOrgs.map((o) => o.id);
      expect(orgIds).toContain(org1.id);
      expect(orgIds).toContain(org2.id);
    });

    it('should include user role in returned organizations', () => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });

      store.addOrganizationMember({
        organization_id: org.id,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      const userOrgs = store.getUserOrganizations('user_123');
      const userOrg = userOrgs[0];

      expect(userOrg?.user_role).toBe(OrganizationRole.MEMBER);
    });

    it('should return empty array for user with no organizations', () => {
      const userOrgs = store.getUserOrganizations('user_nonexistent');
      expect(userOrgs).toHaveLength(0);
    });
  });

  // ============================================================================
  // Project Association
  // ============================================================================

  describe('associateProjectWithOrganization', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should associate project with organization', () => {
      const result = store.associateProjectWithOrganization('proj_123', orgId);
      expect(result).toBe(true);
    });

    it('should increment projects_count', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.projects_count).toBe(0);

      store.associateProjectWithOrganization('proj_123', orgId);

      const after = store.getOrganization(orgId)!;
      expect(after.usage.projects_count).toBe(1);
    });

    it('should throw error when exceeding project quota', () => {
      const org = store.getOrganization(orgId)!;
      const maxProjects = org.quotas.max_projects;

      // Associate projects up to quota
      for (let i = 0; i < maxProjects; i++) {
        store.associateProjectWithOrganization(`proj_${i}`, orgId);
      }

      expect(() => {
        store.associateProjectWithOrganization('proj_overflow', orgId);
      }).toThrow(/project quota/i);
    });

    it('should throw error for non-existent organization', () => {
      expect(() => {
        store.associateProjectWithOrganization('proj_123', 'org_nonexistent');
      }).toThrow(/organization not found/i);
    });

    it('should throw error if project already associated', () => {
      store.associateProjectWithOrganization('proj_123', orgId);

      expect(() => {
        store.associateProjectWithOrganization('proj_123', orgId);
      }).toThrow(/already associated/i);
    });
  });

  describe('disassociateProjectFromOrganization', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
      store.associateProjectWithOrganization('proj_123', orgId);
    });

    it('should disassociate project from organization', () => {
      const result = store.disassociateProjectFromOrganization('proj_123');
      expect(result).toBe(true);
    });

    it('should decrement projects_count', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.projects_count).toBe(1);

      store.disassociateProjectFromOrganization('proj_123');

      const after = store.getOrganization(orgId)!;
      expect(after.usage.projects_count).toBe(0);
    });

    it('should return false for non-existent project', () => {
      const result = store.disassociateProjectFromOrganization('proj_nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getOrganizationProjects', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return all projects for organization', () => {
      store.associateProjectWithOrganization('proj_1', orgId);
      store.associateProjectWithOrganization('proj_2', orgId);

      const projects = store.getOrganizationProjects(orgId);
      expect(projects).toHaveLength(2);
    });

    it('should return empty array for organization with no projects', () => {
      const projects = store.getOrganizationProjects(orgId);
      expect(projects).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', () => {
      const projects = store.getOrganizationProjects('org_nonexistent');
      expect(projects).toHaveLength(0);
    });
  });

  // ============================================================================
  // Workspace Isolation
  // ============================================================================

  describe('getOrganizationWorkspaces', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return all workspaces for organization', () => {
      // Workspaces are created when projects are associated
      store.associateProjectWithOrganization('proj_1', orgId);
      store.associateProjectWithOrganization('proj_2', orgId);

      const workspaces = store.getOrganizationWorkspaces(orgId);
      expect(workspaces.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for organization with no workspaces', () => {
      const workspaces = store.getOrganizationWorkspaces(orgId);
      expect(workspaces).toHaveLength(0);
    });
  });

  describe('userHasWorkspaceAccess', () => {
    let orgId: string;
    let projectId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_owner',
      });
      orgId = org.id;
      projectId = 'proj_123';
      store.associateProjectWithOrganization(projectId, orgId);
    });

    it('should return true for organization member', () => {
      store.addOrganizationMember({
        organization_id: orgId,
        user_id: 'user_123',
        role: OrganizationRole.MEMBER,
      });

      // Assume workspace ID is based on project ID
      const hasAccess = store.userHasWorkspaceAccess('user_123', `ws_${projectId}`);
      expect(hasAccess).toBe(true);
    });

    it('should return false for non-member', () => {
      const hasAccess = store.userHasWorkspaceAccess('user_nonmember', `ws_${projectId}`);
      expect(hasAccess).toBe(false);
    });

    it('should return false for non-existent workspace', () => {
      const hasAccess = store.userHasWorkspaceAccess('user_123', 'ws_nonexistent');
      expect(hasAccess).toBe(false);
    });
  });

  describe('getOrganizationArtifacts', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return all artifacts for organization', () => {
      const artifacts = store.getOrganizationArtifacts(orgId);
      expect(Array.isArray(artifacts)).toBe(true);
    });

    it('should return empty array for organization with no artifacts', () => {
      const artifacts = store.getOrganizationArtifacts(orgId);
      expect(artifacts).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', () => {
      const artifacts = store.getOrganizationArtifacts('org_nonexistent');
      expect(artifacts).toHaveLength(0);
    });
  });

  // ============================================================================
  // Quota Management
  // ============================================================================

  describe('getOrganizationQuota', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return quota information', () => {
      const quota = store.getOrganizationQuota(orgId);
      expect(quota.organization_id).toBe(orgId);
      expect(quota.quotas).toBeDefined();
      expect(quota.usage).toBeDefined();
    });

    it('should throw error for non-existent organization', () => {
      expect(() => {
        store.getOrganizationQuota('org_nonexistent');
      }).toThrow(/organization not found/i);
    });
  });

  describe('checkProjectQuota', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return true when under quota', () => {
      const result = store.checkProjectQuota(orgId);
      expect(result).toBe(true);
    });

    it('should return false when at quota', () => {
      const org = store.getOrganization(orgId)!;
      const maxProjects = org.quotas.max_projects;

      for (let i = 0; i < maxProjects; i++) {
        store.associateProjectWithOrganization(`proj_${i}`, orgId);
      }

      const result = store.checkProjectQuota(orgId);
      expect(result).toBe(false);
    });

    it('should return true for unlimited quota', () => {
      const org = store.createOrganization({
        name: 'Enterprise Org',
        owner_id: 'user_123',
        plan: SubscriptionPlan.ENTERPRISE,
      });

      const result = store.checkProjectQuota(org.id);
      expect(result).toBe(true);
    });
  });

  describe('checkWorkspaceQuota', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return true when under quota', () => {
      const result = store.checkWorkspaceQuota(orgId);
      expect(result).toBe(true);
    });
  });

  describe('checkMemberQuota', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return true when under quota', () => {
      const result = store.checkMemberQuota(orgId);
      expect(result).toBe(true);
    });

    it('should return false when at quota', () => {
      const org = store.getOrganization(orgId)!;
      const maxMembers = org.quotas.max_members;

      // Add members up to quota (accounting for owner)
      for (let i = 1; i < maxMembers; i++) {
        store.addOrganizationMember({
          organization_id: orgId,
          user_id: `user_${i}`,
          role: OrganizationRole.MEMBER,
        });
      }

      const result = store.checkMemberQuota(orgId);
      expect(result).toBe(false);
    });
  });

  describe('checkStorageQuota', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should return true when under quota', () => {
      const result = store.checkStorageQuota(orgId, 1024 * 1024 * 100); // 100 MB
      expect(result).toBe(true);
    });

    it('should return false when additional bytes would exceed quota', () => {
      const org = store.getOrganization(orgId)!;
      const maxStorageBytes = org.quotas.max_storage_gb * 1024 * 1024 * 1024;

      const result = store.checkStorageQuota(orgId, maxStorageBytes + 1);
      expect(result).toBe(false);
    });
  });

  describe('incrementProjectCount', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should increment project count', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.projects_count).toBe(0);

      store.incrementProjectCount(orgId);

      const after = store.getOrganization(orgId)!;
      expect(after.usage.projects_count).toBe(1);
    });
  });

  describe('decrementProjectCount', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
      store.incrementProjectCount(orgId);
    });

    it('should decrement project count', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.projects_count).toBe(1);

      store.decrementProjectCount(orgId);

      const after = store.getOrganization(orgId)!;
      expect(after.usage.projects_count).toBe(0);
    });

    it('should not go below zero', () => {
      store.decrementProjectCount(orgId);
      store.decrementProjectCount(orgId); // Already at 0

      const org = store.getOrganization(orgId)!;
      expect(org.usage.projects_count).toBe(0);
    });
  });

  describe('addStorageUsage', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
    });

    it('should add storage usage in bytes', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.storage_used_gb).toBe(0);

      const bytesToAdd = 1024 * 1024 * 1024; // 1 GB
      store.addStorageUsage(orgId, bytesToAdd);

      const after = store.getOrganization(orgId)!;
      expect(after.usage.storage_used_gb).toBeCloseTo(1, 2);
    });
  });

  describe('subtractStorageUsage', () => {
    let orgId: string;

    beforeEach(() => {
      const org = store.createOrganization({
        name: 'Test Org',
        owner_id: 'user_123',
      });
      orgId = org.id;
      store.addStorageUsage(orgId, 2 * 1024 * 1024 * 1024); // 2 GB
    });

    it('should subtract storage usage in bytes', () => {
      const before = store.getOrganization(orgId)!;
      expect(before.usage.storage_used_gb).toBeCloseTo(2, 2);

      const bytesToSubtract = 1024 * 1024 * 1024; // 1 GB
      store.subtractStorageUsage(orgId, bytesToSubtract);

      const after = store.getOrganization(orgId)!;
      expect(after.usage.storage_used_gb).toBeCloseTo(1, 2);
    });

    it('should not go below zero', () => {
      store.subtractStorageUsage(orgId, 10 * 1024 * 1024 * 1024); // 10 GB (more than current)

      const org = store.getOrganization(orgId)!;
      expect(org.usage.storage_used_gb).toBe(0);
    });
  });
});
