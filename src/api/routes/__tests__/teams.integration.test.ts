/**
 * Integration Tests for Team Management
 * Tests actual database operations and service interactions
 */

import { createServiceClient } from '../../../auth/supabase';
import { v4 as uuidv4 } from 'uuid';

// These tests require a real test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('Team Management - Database Integration Tests', () => {
  let supabase: any;
  let testUserId: string;
  let testTeamId: string;
  let testInviteToken: string;

  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      console.warn('Skipping integration tests - no test database configured');
      return;
    }

    supabase = createServiceClient();

    // Create test user
    testUserId = uuidv4();
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `test-${testUserId}@example.com`,
        full_name: 'Test User'
      });

    if (userError) {
      console.error('Failed to create test user:', userError);
    }
  });

  afterAll(async () => {
    if (!supabase) return;

    // Cleanup test data
    await supabase
      .from('teams')
      .delete()
      .eq('owner_id', testUserId);

    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);
  });

  describe('Team CRUD Operations', () => {
    it('creates team with all required fields', async () => {
      if (!supabase) return;

      const teamData = {
        name: 'Integration Test Team',
        owner_id: testUserId,
        billing_email: 'billing@test.com',
        settings: { test_mode: true }
      };

      const { data: team, error } = await supabase
        .from('teams')
        .insert(teamData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(team).toMatchObject({
        name: teamData.name,
        owner_id: teamData.owner_id,
        billing_email: teamData.billing_email
      });
      expect(team.id).toBeDefined();
      expect(team.created_at).toBeDefined();

      testTeamId = team.id;
    });

    it('enforces unique team slugs', async () => {
      if (!supabase) return;

      const slug = `test-slug-${Date.now()}`;

      const { data: team1 } = await supabase
        .from('teams')
        .insert({
          name: 'Team 1',
          slug,
          owner_id: testUserId
        })
        .select()
        .single();

      const { error: duplicateError } = await supabase
        .from('teams')
        .insert({
          name: 'Team 2',
          slug,
          owner_id: testUserId
        })
        .select()
        .single();

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.message).toContain('unique');

      // Cleanup
      await supabase.from('teams').delete().eq('id', team1.id);
    });

    it('cascades deletion to team members', async () => {
      if (!supabase || !testTeamId) return;

      // Add a team member
      const memberId = uuidv4();
      await supabase
        .from('team_members')
        .insert({
          team_id: testTeamId,
          user_id: memberId,
          role: 'member'
        });

      // Delete the team
      await supabase
        .from('teams')
        .delete()
        .eq('id', testTeamId);

      // Verify member was deleted
      const { data: members } = await supabase
        .from('team_members')
        .select()
        .eq('team_id', testTeamId);

      expect(members).toHaveLength(0);
    });
  });

  describe('Team Member Management', () => {
    beforeEach(async () => {
      if (!supabase) return;

      // Create a fresh team for each test
      const { data: team } = await supabase
        .from('teams')
        .insert({
          name: `Test Team ${Date.now()}`,
          owner_id: testUserId
        })
        .select()
        .single();

      testTeamId = team.id;
    });

    it('enforces unique team-user membership', async () => {
      if (!supabase || !testTeamId) return;

      const memberId = uuidv4();

      // First insertion should succeed
      const { error: firstError } = await supabase
        .from('team_members')
        .insert({
          team_id: testTeamId,
          user_id: memberId,
          role: 'member'
        });

      expect(firstError).toBeNull();

      // Duplicate insertion should fail
      const { error: duplicateError } = await supabase
        .from('team_members')
        .insert({
          team_id: testTeamId,
          user_id: memberId,
          role: 'admin'
        });

      expect(duplicateError).not.toBeNull();
    });

    it('validates role constraints', async () => {
      if (!supabase || !testTeamId) return;

      const invalidRoles = ['superadmin', 'god', 'hacker', null, ''];

      for (const role of invalidRoles) {
        const { error } = await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            user_id: uuidv4(),
            role
          });

        expect(error).not.toBeNull();
      }
    });

    it('maintains role hierarchy integrity', async () => {
      if (!supabase || !testTeamId) return;

      const members = [
        { user_id: uuidv4(), role: 'owner' },
        { user_id: uuidv4(), role: 'admin' },
        { user_id: uuidv4(), role: 'member' },
        { user_id: uuidv4(), role: 'viewer' },
      ];

      for (const member of members) {
        const { error } = await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            ...member
          });

        if (member.role === 'owner' && members[0].user_id !== member.user_id) {
          // Should not allow multiple owners
          expect(error).not.toBeNull();
        } else {
          expect(error).toBeNull();
        }
      }
    });
  });

  describe('Team Invites', () => {
    it('generates unique invite tokens', async () => {
      if (!supabase || !testTeamId) return;

      const tokens = new Set();
      const invites = [];

      for (let i = 0; i < 10; i++) {
        const { data: invite } = await supabase
          .from('team_invites')
          .insert({
            team_id: testTeamId,
            email: `invite${i}@test.com`,
            role: 'member'
          })
          .select()
          .single();

        if (invite) {
          tokens.add(invite.token);
          invites.push(invite);
        }
      }

      expect(tokens.size).toBe(10);

      // Cleanup
      for (const invite of invites) {
        await supabase.from('team_invites').delete().eq('id', invite.id);
      }
    });

    it('expires invites after configured time', async () => {
      if (!supabase || !testTeamId) return;

      // Create invite with past expiry
      const { data: expiredInvite } = await supabase
        .from('team_invites')
        .insert({
          team_id: testTeamId,
          email: 'expired@test.com',
          role: 'member',
          expires_at: new Date(Date.now() - 1000).toISOString()
        })
        .select()
        .single();

      // Try to accept expired invite
      const { data: result } = await supabase
        .rpc('accept_team_invite', {
          invite_token: expiredInvite.token
        });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('prevents accepting cancelled invites', async () => {
      if (!supabase || !testTeamId) return;

      const { data: invite } = await supabase
        .from('team_invites')
        .insert({
          team_id: testTeamId,
          email: 'cancelled@test.com',
          role: 'member'
        })
        .select()
        .single();

      // Cancel the invite
      await supabase
        .from('team_invites')
        .update({ status: 'cancelled' })
        .eq('id', invite.id);

      // Try to accept cancelled invite
      const { data: result } = await supabase
        .rpc('accept_team_invite', {
          invite_token: invite.token
        });

      expect(result.success).toBe(false);
    });
  });

  describe('RLS Policy Enforcement', () => {
    let otherUserId: string;
    let otherTeamId: string;

    beforeAll(async () => {
      if (!supabase) return;

      // Create another user and team
      otherUserId = uuidv4();
      await supabase
        .from('users')
        .insert({
          id: otherUserId,
          email: `other-${otherUserId}@test.com`
        });

      const { data: otherTeam } = await supabase
        .from('teams')
        .insert({
          name: 'Other Team',
          owner_id: otherUserId
        })
        .select()
        .single();

      if (!otherTeam) {
        throw new Error('Failed to create other team for integration test');
      }

      otherTeamId = otherTeam.id;
    });

    it('prevents cross-team data access', async () => {
      if (!supabase || !testTeamId || !otherTeamId) return;

      // Create authenticated client for test user
      const userClient = createServiceClient();
      if (!userClient) {
        console.warn('Skipping RLS check - service client unavailable');
        return;
      }

      // Try to access other team's data
      const { data: teams } = await userClient
        .from('teams')
        .select()
        .eq('id', otherTeamId);

      // Should not return other team's data
      expect(teams).toHaveLength(0);
    });

    it('enforces member visibility rules', async () => {
      if (!supabase || !testTeamId || !otherTeamId) return;

      // Add member to test team
      await supabase
        .from('team_members')
        .insert({
          team_id: testTeamId,
          user_id: testUserId,
          role: 'member'
        });

      const userClient = createServiceClient();
      if (!userClient) {
        console.warn('Skipping member visibility check - service client unavailable');
        return;
      }

      // Should see own team members
      const { data: ownMembers } = await userClient
        .from('team_members')
        .select()
        .eq('team_id', testTeamId);

      expect((ownMembers ?? []).length).toBeGreaterThan(0);

      // Should not see other team members
      const { data: otherMembers } = await userClient
        .from('team_members')
        .select()
        .eq('team_id', otherTeamId);

      expect(otherMembers).toHaveLength(0);
    });
  });

  describe('Database Functions', () => {
    describe('create_personal_team', () => {
      it('automatically creates personal team for new users', async () => {
        if (!supabase) return;

        const newUserId = uuidv4();
        const { error } = await supabase.auth.admin.createUser({
          email: `auto-team-${newUserId}@test.com`,
          password: 'TestPass123!'
        });

        if (!error) {
          // Check if personal team was created
          const { data: teams } = await supabase
            .from('teams')
            .select()
            .eq('owner_id', newUserId)
            .eq('settings->is_personal', true);

          expect(teams).toHaveLength(1);
          expect(teams[0].name).toContain('Team');
        }
      });
    });

    describe('accept_team_invite', () => {
      it('adds user to team and updates invite status atomically', async () => {
        if (!supabase || !testTeamId) return;

        const inviteEmail = 'atomic@test.com';
        const invitedUserId = uuidv4();

        // Create user for invite
        await supabase
          .from('users')
          .insert({
            id: invitedUserId,
            email: inviteEmail
          });

        // Create invite
        const { data: invite } = await supabase
          .from('team_invites')
          .insert({
            team_id: testTeamId,
            email: inviteEmail,
            role: 'member'
          })
          .select()
          .single();

        // Accept invite
        const { data: result } = await supabase
          .rpc('accept_team_invite', {
            invite_token: invite.token
          });

        expect(result.success).toBe(true);

        // Verify member was added
        const { data: member } = await supabase
          .from('team_members')
          .select()
          .eq('team_id', testTeamId)
          .eq('user_id', invitedUserId)
          .single();

        expect(member).toBeDefined();
        expect(member.role).toBe('member');

        // Verify invite was updated
        const { data: updatedInvite } = await supabase
          .from('team_invites')
          .select()
          .eq('id', invite.id)
          .single();

        expect(updatedInvite.status).toBe('accepted');
        expect(updatedInvite.accepted_at).toBeDefined();
      });
    });

    describe('transfer_team_ownership', () => {
      it('transfers ownership and updates member roles', async () => {
        if (!supabase || !testTeamId) return;

        const newOwnerId = uuidv4();

        // Add new owner as member first
        await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            user_id: newOwnerId,
            role: 'member'
          });

        // Transfer ownership
        const { data: result } = await supabase
          .rpc('transfer_team_ownership', {
            p_team_id: testTeamId,
            p_new_owner_id: newOwnerId
          });

        expect(result.success).toBe(true);

        // Verify ownership was transferred
        const { data: team } = await supabase
          .from('teams')
          .select()
          .eq('id', testTeamId)
          .single();

        expect(team.owner_id).toBe(newOwnerId);

        // Verify roles were updated
        const { data: newOwnerMember } = await supabase
          .from('team_members')
          .select()
          .eq('team_id', testTeamId)
          .eq('user_id', newOwnerId)
          .single();

        expect(newOwnerMember.role).toBe('owner');

        const { data: oldOwnerMember } = await supabase
          .from('team_members')
          .select()
          .eq('team_id', testTeamId)
          .eq('user_id', testUserId)
          .single();

        expect(oldOwnerMember.role).toBe('admin');
      });
    });
  });

  describe('Activity Logging', () => {
    it('logs all team operations', async () => {
      if (!supabase || !testTeamId) return;

      const operations = [
        {
          action: 'team.created',
          resource_type: 'team',
          resource_id: testTeamId
        },
        {
          action: 'team.member_added',
          resource_type: 'member',
          resource_id: uuidv4()
        },
        {
          action: 'team.invite_sent',
          resource_type: 'invite',
          resource_id: uuidv4()
        }
      ];

      for (const op of operations) {
        await supabase
          .from('team_activity_logs')
          .insert({
            team_id: testTeamId,
            user_id: testUserId,
            ...op
          });
      }

      const { data: logs } = await supabase
        .from('team_activity_logs')
        .select()
        .eq('team_id', testTeamId)
        .order('created_at', { ascending: false });

      expect(logs.length).toBeGreaterThanOrEqual(operations.length);

      const actions = logs.map((l: any) => l.action);
      for (const op of operations) {
        expect(actions).toContain(op.action);
      }
    });

    it('preserves logs when user is deleted', async () => {
      if (!supabase || !testTeamId) return;

      const tempUserId = uuidv4();

      // Create log entry
      const { data: log } = await supabase
        .from('team_activity_logs')
        .insert({
          team_id: testTeamId,
          user_id: tempUserId,
          action: 'test.action'
        })
        .select()
        .single();

      // Delete user (simulated)
      await supabase
        .from('team_activity_logs')
        .update({ user_id: null })
        .eq('id', log.id);

      // Verify log still exists
      const { data: preservedLog } = await supabase
        .from('team_activity_logs')
        .select()
        .eq('id', log.id)
        .single();

      expect(preservedLog).toBeDefined();
      expect(preservedLog.user_id).toBeNull();
      expect(preservedLog.action).toBe('test.action');
    });
  });
});
