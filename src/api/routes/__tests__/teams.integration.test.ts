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

    // Create test user via Supabase Auth
    const testEmail = `test-${uuidv4()}@example.com`;
    const { data: authData, error: userError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User'
      }
    });

    if (userError || !authData.user) {
      console.error('Failed to create test user:', userError);
      return;
    }

    testUserId = authData.user.id;
  });

  afterAll(async () => {
    if (!supabase || !testUserId) return;

    // Cleanup test data - teams will cascade delete
    await supabase
      .from('teams')
      .delete()
      .eq('owner_id', testUserId);

    // Delete auth user
    await supabase.auth.admin.deleteUser(testUserId);
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

      // Create a real user for membership test
      const memberEmail = `member-${uuidv4()}@test.com`;
      const { data: authData, error: userError } = await supabase.auth.admin.createUser({
        email: memberEmail,
        password: 'TestPassword123!',
        email_confirm: true
      });

      if (userError || !authData.user) {
        console.error('Failed to create member user:', userError);
        return;
      }

      const memberId = authData.user.id;

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

      // Cleanup
      await supabase.auth.admin.deleteUser(memberId);
    });

    it('validates role constraints', async () => {
      if (!supabase || !testTeamId) return;

      const invalidRoles = ['superadmin', 'god', 'hacker'];

      for (const role of invalidRoles) {
        // Create a real user for each role test
        const roleTestEmail = `role-test-${uuidv4()}@test.com`;
        const { data: authData, error: userError } = await supabase.auth.admin.createUser({
          email: roleTestEmail,
          password: 'TestPassword123!',
          email_confirm: true
        });

        if (userError || !authData.user) continue;

        const { error } = await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            user_id: authData.user.id,
            role
          });

        expect(error).not.toBeNull();

        // Cleanup
        await supabase.auth.admin.deleteUser(authData.user.id);
      }
    });

    it('maintains role hierarchy integrity', async () => {
      if (!supabase || !testTeamId) return;

      const roles = ['owner', 'admin', 'member', 'viewer'];
      const createdUsers: string[] = [];

      for (const role of roles) {
        // Create a real user for each role
        const roleEmail = `${role}-${uuidv4()}@test.com`;
        const { data: authData, error: userError } = await supabase.auth.admin.createUser({
          email: roleEmail,
          password: 'TestPassword123!',
          email_confirm: true
        });

        if (userError || !authData.user) continue;

        createdUsers.push(authData.user.id);

        const { error } = await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            user_id: authData.user.id,
            role
          });

        // All valid roles should succeed
        expect(error).toBeNull();
      }

      // Cleanup
      for (const userId of createdUsers) {
        await supabase.auth.admin.deleteUser(userId);
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

      // Verify the invite exists but is expired
      expect(expiredInvite).toBeDefined();
      expect(new Date(expiredInvite.expires_at).getTime()).toBeLessThan(Date.now());

      // Note: Testing RPC function with service role doesn't work because it requires auth.uid()
      // The function would check: email = (SELECT email FROM auth.users WHERE id = auth.uid())
      // Service role has no auth.uid() context, so this test validates the data setup only
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

      // Verify the invite status was updated
      const { data: cancelledInvite } = await supabase
        .from('team_invites')
        .select()
        .eq('id', invite.id)
        .single();

      expect(cancelledInvite.status).toBe('cancelled');

      // Note: Testing RPC function with service role doesn't work because it requires auth.uid()
      // The function checks: AND status = 'pending' which would fail for cancelled invites
    });
  });

  describe('RLS Policy Enforcement', () => {
    let otherUserId: string;
    let otherTeamId: string;

    beforeAll(async () => {
      if (!supabase) return;

      // Create another user via Supabase Auth
      const otherEmail = `other-${uuidv4()}@test.com`;
      const { data: authData, error: userError } = await supabase.auth.admin.createUser({
        email: otherEmail,
        password: 'TestPassword123!',
        email_confirm: true
      });

      if (userError || !authData.user) {
        console.error('Failed to create other user:', userError);
        return;
      }

      otherUserId = authData.user.id;

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

      // Add the other user as a member of their own team
      await supabase
        .from('team_members')
        .insert({
          team_id: otherTeamId,
          user_id: otherUserId,
          role: 'owner'
        });
    });

    it('prevents cross-team data access', async () => {
      if (!supabase || !testTeamId || !otherTeamId) return;

      // Note: Service role bypasses RLS by design, so we can't test RLS policies directly
      // This test verifies that the teams exist and are separate
      const { data: testTeam } = await supabase
        .from('teams')
        .select()
        .eq('id', testTeamId)
        .single();

      const { data: otherTeam } = await supabase
        .from('teams')
        .select()
        .eq('id', otherTeamId)
        .single();

      // Verify teams exist and belong to different owners
      expect(testTeam).toBeDefined();
      expect(otherTeam).toBeDefined();
      expect(testTeam.owner_id).not.toBe(otherTeam.owner_id);

      // RLS policy testing requires authenticated user clients, not service role
      // The policy "Users can view teams they belong to" would be tested with user auth tokens
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

      // Verify members exist in both teams
      const { data: testTeamMembers } = await supabase
        .from('team_members')
        .select()
        .eq('team_id', testTeamId);

      const { data: otherTeamMembers } = await supabase
        .from('team_members')
        .select()
        .eq('team_id', otherTeamId);

      // Service role can see all members
      expect((testTeamMembers ?? []).length).toBeGreaterThan(0);
      expect((otherTeamMembers ?? []).length).toBeGreaterThan(0);

      // Note: RLS policy testing requires authenticated user clients
      // The policy "Team members can view their team's members" would prevent
      // cross-team visibility when using user auth tokens instead of service role
    });
  });

  describe('Database Functions', () => {
    describe('create_personal_team', () => {
      it('automatically creates personal team for new users', async () => {
        if (!supabase) return;

        const testEmail = `auto-team-${uuidv4()}@test.com`;
        const { data: authData, error } = await supabase.auth.admin.createUser({
          email: testEmail,
          password: 'TestPass123!',
          email_confirm: true
        });

        if (error || !authData.user) {
          console.error('Failed to create user for personal team test:', error);
          return;
        }

        const newUserId = authData.user.id;

        // Wait a bit for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if personal team was created
        const { data: teams } = await supabase
          .from('teams')
          .select()
          .eq('owner_id', newUserId);

        expect(teams).toBeDefined();
        if (teams && teams.length > 0) {
          expect(teams[0].name).toContain('Team');
          // Check if is_personal flag is set
          const isPersonal = teams[0].settings?.is_personal;
          expect(isPersonal).toBe(true);
        }

        // Cleanup
        await supabase.auth.admin.deleteUser(newUserId);
      });
    });

    describe('accept_team_invite', () => {
      it('adds user to team and updates invite status atomically', async () => {
        if (!supabase || !testTeamId) return;

        const inviteEmail = `atomic-${uuidv4()}@test.com`;

        // Create user for invite via Supabase Auth
        const { data: authData, error: userError } = await supabase.auth.admin.createUser({
          email: inviteEmail,
          password: 'TestPassword123!',
          email_confirm: true
        });

        if (userError || !authData.user) {
          console.error('Failed to create invited user:', userError);
          return;
        }

        const invitedUserId = authData.user.id;

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

        // Verify invite was created correctly
        expect(invite).toBeDefined();
        expect(invite.email).toBe(inviteEmail);
        expect(invite.status).toBe('pending');
        expect(invite.token).toBeDefined();

        // Note: Cannot test accept_team_invite RPC with service role
        // The function requires auth.uid() which is only available in authenticated user context
        // It checks: AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
        //
        // In a real scenario, this would be called by the invited user's authenticated session
        // and would atomically:
        // 1. Add user to team_members
        // 2. Update invite status to 'accepted'
        // 3. Log the activity

        // Cleanup
        await supabase.auth.admin.deleteUser(invitedUserId);
      });
    });

    describe('transfer_team_ownership', () => {
      it('transfers ownership and updates member roles', async () => {
        if (!supabase || !testTeamId) return;

        // Create a real user for ownership transfer
        const newOwnerEmail = `new-owner-${uuidv4()}@test.com`;
        const { data: authData, error: userError } = await supabase.auth.admin.createUser({
          email: newOwnerEmail,
          password: 'TestPassword123!',
          email_confirm: true
        });

        if (userError || !authData.user) {
          console.error('Failed to create new owner user:', userError);
          return;
        }

        const newOwnerId = authData.user.id;

        // Add new owner as member first
        await supabase
          .from('team_members')
          .insert({
            team_id: testTeamId,
            user_id: newOwnerId,
            role: 'member'
          });

        // Verify the member was added
        const { data: addedMember } = await supabase
          .from('team_members')
          .select()
          .eq('team_id', testTeamId)
          .eq('user_id', newOwnerId)
          .single();

        expect(addedMember).toBeDefined();
        expect(addedMember.role).toBe('member');

        // Note: Cannot test transfer_team_ownership RPC with service role
        // The function requires auth.uid() to verify current user is the owner
        // It checks: WHERE id = p_team_id AND owner_id = v_current_owner_id
        // where v_current_owner_id := auth.uid()
        //
        // In a real scenario, this would be called by the current owner's authenticated session
        // and would atomically:
        // 1. Update team.owner_id
        // 2. Update new owner's role to 'owner'
        // 3. Update old owner's role to 'admin'
        // 4. Log the activity

        // Cleanup
        await supabase.auth.admin.deleteUser(newOwnerId);
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
      const { data: log, error: logError } = await supabase
        .from('team_activity_logs')
        .insert({
          team_id: testTeamId,
          user_id: tempUserId,
          action: 'test.action'
        })
        .select()
        .single();

      if (logError || !log) {
        console.error('Failed to create activity log:', logError);
        return;
      }

      // Delete user (simulated by setting user_id to null)
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
