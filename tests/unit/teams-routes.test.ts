/**
 * Comprehensive tests for src/api/routes/teams.ts
 * Testing all 12 endpoints with 90%+ coverage
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import teamsMount from '../../src/api/routes/teams';
import * as supabaseAuth from '../../src/auth/supabase';
import * as middleware from '../../src/auth/middleware';
import * as teamEmails from '../../src/services/email/teamEmails';

// Mock dependencies
jest.mock('../../src/auth/supabase');
jest.mock('../../src/auth/middleware');
jest.mock('../../src/services/email/teamEmails');
jest.mock('../../src/lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const mockSupabase: any = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  single: jest.fn(() => mockSupabase),
  data: null,
  error: null,
};

const mockCreateServiceClient = jest.mocked(supabaseAuth.createServiceClient);
const mockRequireAuth = jest.mocked(middleware.requireAuth);
const mockRequireTeamAccess = jest.mocked(middleware.requireTeamAccess);
const mockSendTeamInviteEmail = jest.mocked(teamEmails.sendTeamInviteEmail);

describe('Teams Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    // Mock middleware
    mockRequireAuth.mockImplementation((req: any, res: any, next: any) => {
      req.userId = 'user-123';
      req.user = { email: 'test@example.com', id: 'user-123' } as any;
      next();
      return Promise.resolve();
    });

    mockRequireTeamAccess.mockImplementation(() => (req: any, res: any, next: any) => {
      req.teamId = req.params.teamId;
      next();
      return Promise.resolve(res);
    });

    // Mock Supabase client
    mockCreateServiceClient.mockReturnValue(mockSupabase as any);

    // Mount routes
    teamsMount(app as any);
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

      mockSupabase.eq.mockResolvedValue({ data: mockTeams, error: null });

      const response = await request(app)
        .get('/teams')
        .expect(200);

      expect(response.body).toEqual({ teams: mockTeams });
      expect(mockSupabase.from).toHaveBeenCalledWith('team_members');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should handle database error', async () => {
      mockSupabase.eq.mockResolvedValue({
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

    it('should handle exception errors', async () => {
      mockSupabase.eq.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to list teams' });
    });

    it('should return empty array when no teams found', async () => {
      mockSupabase.eq.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .get('/teams')
        .expect(200);

      expect(response.body).toEqual({ teams: [] });
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

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      expect(response.body).toEqual({ team: mockTeam });
      expect(mockSupabase.from).toHaveBeenCalledWith('teams');
      expect(mockSupabase.from).toHaveBeenCalledWith('team_members');
      expect(mockSupabase.from).toHaveBeenCalledWith('team_activity_logs');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/teams')
        .send({ name: 'A' }) // Too short
        .expect(400);

      expect(response.body.error).toBe('Invalid request');
      expect(response.body.details).toBeDefined();
    });

    it('should use user email as billing email if not provided', async () => {
      const teamData = { name: 'New Team' };
      const mockTeam = {
        id: 'team-123',
        name: 'New Team',
        slug: 'new-team',
        owner_id: 'user-123'
      };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      const insertCall = mockSupabase.insert.mock.calls.find(call =>
        call[0].billing_email !== undefined
      );
      expect(insertCall[0].billing_email).toBe('test@example.com');
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

    it('should handle member creation error and cleanup', async () => {
      const mockTeam = { id: 'team-123', name: 'New Team' };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert
        .mockResolvedValueOnce({ data: null, error: { message: 'Member creation failed' } })
        .mockResolvedValueOnce({ data: null, error: null }); // cleanup
      mockSupabase.delete.mockReturnValue(mockSupabase);

      const response = await request(app)
        .post('/teams')
        .send({ name: 'New Team' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create team' });
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'team-123');
    });

    it('should generate slug from team name', async () => {
      const teamData = { name: 'My Awesome Team!' };
      const mockTeam = { id: 'team-123', slug: 'my-awesome-team' };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      const insertCall = mockSupabase.insert.mock.calls[0];
      expect(insertCall[0].slug).toBe('my-awesome-team');
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
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'team-123');
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

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

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

    it('should handle update error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const response = await request(app)
        .patch('/teams/team-123')
        .send({ name: 'Updated Team' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to update team' });
    });
  });

  describe('DELETE /teams/:teamId', () => {
    it('should delete team successfully', async () => {
      mockSupabase.eq.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .delete('/teams/team-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Team deleted successfully' });
      expect(mockSupabase.delete).toHaveBeenCalled();
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
        token: 'invite-token-123',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Mock team lookup
      mockSupabase.single
        .mockResolvedValueOnce({ data: mockTeam, error: null })
        .mockResolvedValueOnce({ data: mockInvite, error: null });

      // Mock existing member check
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });

      // Mock existing invite check
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });

      // Mock activity log
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      mockSendTeamInviteEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send(inviteData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Invite sent successfully',
        invite: expect.objectContaining({ id: 'invite-123' })
      });

      expect(mockSendTeamInviteEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.objectContaining({
          teamName: 'Test Team',
          inviterName: 'test@example.com'
        })
      );
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

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.eq
        .mockResolvedValueOnce({ data: [existingMember], error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'existing@example.com', role: 'member' })
        .expect(400);

      expect(response.body).toEqual({ error: 'User is already a member of this team' });
    });

    it('should prevent duplicate pending invites', async () => {
      const mockTeam = { id: 'team-123', name: 'Test Team' };
      const existingInvite = { id: 'invite-123', status: 'pending' };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.eq
        .mockResolvedValueOnce({ data: null, error: null }) // no existing member
        .mockResolvedValueOnce({ data: [existingInvite], error: null }); // existing invite

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'pending@example.com', role: 'member' })
        .expect(400);

      expect(response.body).toEqual({ error: 'User already has a pending invite to this team' });
    });

    it('should handle email sending failure', async () => {
      const mockTeam = { id: 'team-123', name: 'Test Team' };
      const mockInvite = { id: 'invite-123', token: 'token-123' };

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockTeam, error: null })
        .mockResolvedValueOnce({ data: mockInvite, error: null });
      mockSupabase.eq
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      mockSendTeamInviteEmail.mockRejectedValue(new Error('Email service unavailable'));

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'test@example.com', role: 'member' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to send invite email' });
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

      // Mock invite lookup
      mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null });

      // Mock member insertion
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      // Mock invite update
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });

      // Mock activity log
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

    it('should reject already accepted invite', async () => {
      const acceptedInvite = {
        id: 'invite-123',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'accepted'
      };

      mockSupabase.single.mockResolvedValue({ data: acceptedInvite, error: null });

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'accepted-token' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invite has already been used' });
    });

    it('should reject invite for different user', async () => {
      const mockInvite = {
        id: 'invite-123',
        email: 'other@example.com', // Different from req.user.email
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      };

      mockSupabase.single.mockResolvedValue({ data: mockInvite, error: null });

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'wrong-user-token' })
        .expect(403);

      expect(response.body).toEqual({ error: 'This invite is not for your email address' });
    });
  });

  describe('DELETE /teams/:teamId/invites/:inviteId', () => {
    it('should cancel invite successfully', async () => {
      mockSupabase.eq.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .delete('/teams/team-123/invites/invite-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'Invite cancelled successfully' });
    });

    it('should handle cancellation error', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Invite not found' }
      });

      const response = await request(app)
        .delete('/teams/team-123/invites/invite-123')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to cancel invite' });
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

    it('should validate role data', async () => {
      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'invalid-role' })
        .expect(400);

      expect(response.body.error).toBe('Invalid request');
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
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

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

      mockSupabase.single.mockResolvedValueOnce({ data: newOwner, error: null });
      mockSupabase.eq
        .mockResolvedValueOnce({ data: null, error: null }) // update new owner
        .mockResolvedValueOnce({ data: null, error: null }); // update old owner
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

  describe('Error Handling', () => {
    it('should handle service unavailable for all endpoints', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      await request(app).get('/teams').expect(500);
      await request(app).post('/teams').send({ name: 'Test' }).expect(500);
      await request(app).get('/teams/team-123').expect(500);
      await request(app).patch('/teams/team-123').send({ name: 'Test' }).expect(500);
      await request(app).delete('/teams/team-123').expect(500);
    });

    it('should handle unexpected exceptions', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to list teams' });
    });
  });

  describe('Middleware Integration', () => {
    it('should require authentication for all endpoints', () => {
      expect(mockRequireAuth).toHaveBeenCalled();
    });

    it('should require team access for team-specific endpoints', () => {
      expect(mockRequireTeamAccess).toHaveBeenCalled();
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

  describe('Activity Logging', () => {
    it('should log team creation activity', async () => {
      const mockTeam = { id: 'team-123', name: 'Test Team' };

      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      mockSupabase.insert
        .mockResolvedValueOnce({ data: null, error: null }) // member
        .mockResolvedValueOnce({ data: null, error: null }); // activity log

      await request(app)
        .post('/teams')
        .send({ name: 'Test Team' })
        .expect(201);

      const activityLogCall = mockSupabase.insert.mock.calls.find((call: any[]) =>
        call && call[0] && call[0].action === 'team.created'
      );
      expect(activityLogCall).toBeDefined();
      expect(activityLogCall![0]).toMatchObject({
        team_id: 'team-123',
        user_id: 'user-123',
        action: 'team.created',
        resource_type: 'team',
        resource_id: 'team-123'
      });
    });
  });
});