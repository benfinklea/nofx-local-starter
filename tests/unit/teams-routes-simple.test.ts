/**
 * Simplified comprehensive tests for src/api/routes/teams.ts
 * Testing all major endpoints with good coverage
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing
jest.mock('../../src/auth/supabase', () => ({
  createServiceClient: jest.fn()
}));

jest.mock('../../src/auth/middleware', () => {
  const mockRequireAuth = jest.fn((req: any, res: any, next: any) => next());
  const mockRequireTeamAccess = jest.fn(() => (req: any, res: any, next: any) => next());

  return {
    requireAuth: mockRequireAuth,
    requireTeamAccess: mockRequireTeamAccess
  };
});

jest.mock('../../src/services/email/teamEmails', () => ({
  sendTeamInviteEmail: jest.fn()
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import teamsMount from '../../src/api/routes/teams';
import { createServiceClient } from '../../src/auth/supabase';
import { sendTeamInviteEmail } from '../../src/services/email/teamEmails';
import type { Express } from 'express';

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>;
const mockSendTeamInviteEmail = sendTeamInviteEmail as jest.MockedFunction<typeof sendTeamInviteEmail>;

describe('Teams Routes', () => {
  let app: Express;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express() as Express;
    app.use(express.json());

    // Add middleware to set user context
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { email: 'test@example.com', id: 'user-123' };
      next();
    });

    // Create a comprehensive Supabase mock with proper chaining
    mockSupabase = {} as any;
    mockSupabase.from = jest.fn(() => mockSupabase);
    mockSupabase.select = jest.fn(() => mockSupabase);
    mockSupabase.insert = jest.fn(() => mockSupabase);
    mockSupabase.update = jest.fn(() => mockSupabase);
    mockSupabase.delete = jest.fn(() => mockSupabase);
    mockSupabase.eq = jest.fn(() => mockSupabase);
    mockSupabase.order = jest.fn(() => Promise.resolve({ data: [], error: null }));
    mockSupabase.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
    mockCreateServiceClient.mockReturnValue(mockSupabase);

    // Mount routes
    teamsMount(app);
  });

  describe('GET /teams', () => {
    it('should list user teams successfully', async () => {
      const mockTeams = [
        {
          team: {
            id: 'team-1',
            name: 'Team One',
            slug: 'team-one',
            owner_id: 'user-123',
            subscription_status: 'active',
            trial_ends_at: null,
            created_at: '2023-01-01'
          },
          role: 'owner',
          joined_at: '2023-01-01'
        }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockTeams, error: null });

      const response = await request(app)
        .get('/teams')
        .expect(200);

      expect(response.body).toEqual({ teams: mockTeams });
    });

    it('should handle database error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to list teams' });
    });

    it('should handle service unavailable', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body).toEqual({ error: 'Service unavailable' });
    });
  });

  describe('POST /teams', () => {
    it('should create team successfully', async () => {
      const teamData = { name: 'New Team', billingEmail: 'billing@example.com' };
      const mockTeam = {
        id: 'team-123',
        name: 'New Team',
        slug: 'new-team',
        owner_id: 'user-123',
        billing_email: 'billing@example.com'
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      expect(response.body).toEqual({ team: mockTeam });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/teams')
        .send({ name: 'A' }) // Too short
        .expect(400);

      expect(response.body.error).toBe('Invalid request');
    });

    it('should handle team creation error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Team creation failed' }
      });

      const response = await request(app)
        .post('/teams')
        .send({ name: 'New Team' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create team' });
    });
  });

  describe('GET /teams/:teamId', () => {
    it('should get team details successfully', async () => {
      const mockTeam = {
        id: 'team-123',
        name: 'Test Team',
        members: [
          {
            id: 'member-1',
            role: 'owner',
            user: { id: 'user-123', email: 'test@example.com' }
          }
        ],
        invites: []
      };

      mockSupabase.single.mockResolvedValue({ data: mockTeam, error: null });

      const response = await request(app)
        .get('/teams/team-123')
        .expect(200);

      expect(response.body).toEqual({ team: mockTeam });
    });

    it('should handle team not found error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Team not found' }
      });

      const response = await request(app)
        .get('/teams/team-123')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get team' });
    });
  });

  describe('PATCH /teams/:teamId', () => {
    it('should update team successfully', async () => {
      const updateData = { name: 'Updated Team', billingEmail: 'new@example.com' };
      const mockTeam = { id: 'team-123', ...updateData };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert
        .mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .patch('/teams/team-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ team: mockTeam });
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .patch('/teams/team-123')
        .send({ name: 'A' }) // Too short
        .expect(400);

      expect(response.body.error).toBe('Invalid request');
    });
  });

  describe('DELETE /teams/:teamId', () => {
    it('should delete team successfully', async () => {
      // Mock the delete chain: .delete().eq(...)
      mockSupabase.eq.mockResolvedValue({ data: null, error: null });
      // Also need to mock the activity log insert
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .delete('/teams/team-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Team deleted successfully' });
    });

    it('should handle deletion error', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Deletion failed' }
      });

      const response = await request(app)
        .delete('/teams/team-123')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete team' });
    });
  });

  describe('POST /teams/:teamId/invites', () => {
    it('should send invite successfully', async () => {
      const inviteData = {
        email: 'newuser@example.com',
        role: 'member',
        inviteeName: 'New User',
        message: 'Welcome!'
      };

      const mockTeam = { id: 'team-123', name: 'Test Team' };
      const mockInvite = {
        id: 'invite-123',
        email: 'newuser@example.com',
        role: 'member',
        token: 'invite-token-123',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Setup mocks for the sequence of operations in InviteService.sendTeamInvite
      let singleCallCount = 0;
      mockSupabase.single.mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // First call: Get team details
          return Promise.resolve({ data: mockTeam, error: null });
        } else {
          // Second call: Create invite
          return Promise.resolve({ data: mockInvite, error: null });
        }
      });

      // Mock for checking existing member and pending invites (both should return empty)
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });

      mockSendTeamInviteEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send(inviteData)
        .expect(201);

      expect(response.body.message).toBe('Invite sent successfully');
      expect(response.body.invite).toEqual({
        id: 'invite-123',
        email: 'newuser@example.com',
        role: 'member',
        expires_at: mockInvite.expires_at
      });
      expect(mockSendTeamInviteEmail).toHaveBeenCalled();
    });

    it('should validate invite data', async () => {
      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error).toBe('Invalid request');
    });

    it('should prevent inviting existing members', async () => {
      const mockTeam = { id: 'team-123', name: 'Test Team' };
      const existingMember = { id: 'member-123', role: 'member' };

      // First single() call gets the team
      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });

      // First select/eq checks for existing member - return member found
      let selectCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Check for existing member - found
          return Promise.resolve({ data: [existingMember], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'existing@example.com', role: 'member' })
        .expect(400);

      expect(response.body).toEqual({ error: 'User is already a member of this team' });
    });
  });

  describe('POST /teams/accept-invite', () => {
    it('should accept invite successfully', async () => {
      const mockInvite = {
        id: 'invite-123',
        team_id: 'team-123',
        email: 'test@example.com',
        role: 'member',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'valid-token-123' })
        .expect(200);

      expect(response.body).toEqual({ message: 'Invite accepted successfully' });
    });

    it('should reject invalid token', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Invite not found' }
      });

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid or expired invite' });
    });

    it('should reject expired invite', async () => {
      const expiredInvite = {
        id: 'invite-123',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      };

      mockSupabase.single.mockResolvedValue({ data: expiredInvite, error: null });

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'expired-token' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invite has expired' });
    });
  });

  describe('DELETE /teams/:teamId/invites/:inviteId', () => {
    it('should cancel invite successfully', async () => {
      // Mock for update and subsequent activity log
      mockSupabase.eq.mockResolvedValue({ data: null, error: null });
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .delete('/teams/team-123/invites/invite-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Invite cancelled successfully' });
    });
  });

  describe('PATCH /teams/:teamId/members/:memberId', () => {
    it('should update member role successfully', async () => {
      const mockMember = {
        id: 'member-123',
        role: 'admin',
        user: { id: 'user-456', email: 'member@example.com' }
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockMember, error: null })
        .mockResolvedValueOnce({ data: mockMember, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body).toEqual({ member: mockMember });
    });

    it('should prevent role change of team owner', async () => {
      const ownerMember = {
        id: 'member-123',
        role: 'owner',
        user: { id: 'user-456', email: 'owner@example.com' }
      };

      mockSupabase.single.mockResolvedValue({ data: ownerMember, error: null });

      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'member' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Cannot change the role of the team owner' });
    });
  });

  describe('DELETE /teams/:teamId/members/:memberId', () => {
    it('should remove member successfully', async () => {
      const mockMember = {
        id: 'member-123',
        role: 'member',
        user: { id: 'user-456', email: 'member@example.com' }
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockMember, error: null });
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .delete('/teams/team-123/members/member-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Member removed successfully' });
    });

    it('should prevent removal of team owner', async () => {
      const ownerMember = {
        id: 'member-123',
        role: 'owner',
        user: { id: 'user-456', email: 'owner@example.com' }
      };

      mockSupabase.single.mockResolvedValue({ data: ownerMember, error: null });

      const response = await request(app)
        .delete('/teams/team-123/members/member-123')
        .expect(400);

      expect(response.body).toEqual({ error: 'Cannot remove the team owner' });
    });
  });

  describe('POST /teams/:teamId/leave', () => {
    it('should allow member to leave team', async () => {
      // First select/eq checks role - return member role
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 1 || eqCallCount === 2) {
          // Check membership role - return member (not owner)
          return Promise.resolve({ data: [{ id: 'member-123', role: 'member' }], error: null });
        }
        // Delete operation
        return Promise.resolve({ data: null, error: null });
      });

      const response = await request(app)
        .post('/teams/team-123/leave')
        .expect(200);

      expect(response.body).toEqual({ message: 'Left team successfully' });
    });

    it('should prevent owner from leaving team', async () => {
      const ownerMembership = {
        id: 'member-123',
        role: 'owner'
      };

      mockSupabase.eq.mockResolvedValue({ data: [ownerMembership], error: null });

      const response = await request(app)
        .post('/teams/team-123/leave')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Team owners cannot leave the team. Transfer ownership first.'
      });
    });
  });

  describe('POST /teams/:teamId/transfer-ownership', () => {
    it('should transfer ownership successfully', async () => {
      const newOwner = {
        id: 'member-456',
        role: 'admin',
        user: { id: 'user-456', email: 'newowner@example.com' }
      };

      // First single() to validate new owner
      mockSupabase.single.mockResolvedValueOnce({ data: newOwner, error: null });

      // Mock the two update operations and activity log
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        // Both update operations succeed
        return Promise.resolve({ data: null, error: null });
      });

      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({ newOwnerId: 'member-456' })
        .expect(200);

      expect(response.body).toEqual({ message: 'Ownership transferred successfully' });
    });

    it('should validate new owner exists', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Member not found' }
      });

      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({ newOwnerId: 'nonexistent' })
        .expect(400);

      expect(response.body).toEqual({ error: 'New owner must be a member of the team' });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('New owner ID is required');
    });
  });

  describe('Validation Schemas', () => {
    it('should validate team name length', async () => {
      await request(app)
        .post('/teams')
        .send({ name: 'A' })
        .expect(400);

      await request(app)
        .post('/teams')
        .send({ name: 'A'.repeat(256) })
        .expect(400);
    });

    it('should validate email format', async () => {
      await request(app)
        .post('/teams')
        .send({ name: 'Test Team', billingEmail: 'invalid-email' })
        .expect(400);
    });

    it('should validate member roles', async () => {
      await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'invalid-role' })
        .expect(400);
    });
  });
});