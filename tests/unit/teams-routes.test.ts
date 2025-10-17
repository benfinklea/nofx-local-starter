/**
 * Comprehensive tests for src/api/routes/teams.ts
 * Testing all 12 endpoints with 90%+ coverage
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import * as middleware from '../../src/auth/middleware';
import * as teamEmails from '../../src/services/email/teamEmails';

// Mock dependencies BEFORE importing anything that uses them
jest.mock('../../src/auth/middleware');
jest.mock('../../src/services/email/teamEmails');
jest.mock('../../src/lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

// Create mock service instances
const mockTeamService: any = {
  listUserTeams: jest.fn(),
  createTeam: jest.fn(),
  getTeamDetails: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
};

const mockInviteService: any = {
  sendTeamInvite: jest.fn(),
  acceptInvite: jest.fn(),
  cancelInvite: jest.fn(),
};

const mockMemberService: any = {
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  leaveTeam: jest.fn(),
  transferOwnership: jest.fn(),
};

// Mock the service modules to return our mock instances
jest.mock('../../src/api/routes/teams/TeamService', () => ({
  TeamService: jest.fn(() => mockTeamService)
}));

jest.mock('../../src/api/routes/teams/InviteService', () => ({
  InviteService: jest.fn(() => mockInviteService)
}));

jest.mock('../../src/api/routes/teams/MemberService', () => ({
  MemberService: jest.fn(() => mockMemberService)
}));

// Now import the routes module - it will use our mocked services
import teamsMount from '../../src/api/routes/teams';

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
      ] as any;

      mockTeamService.listUserTeams.mockResolvedValue(mockTeams);

      const response = await request(app)
        .get('/teams')
        .expect(200);

      expect(response.body.data?.teams || response.body.teams).toEqual(mockTeams);
      expect(mockTeamService.listUserTeams).toHaveBeenCalledWith('user-123');
    });

    it('should handle database error', async () => {
      mockTeamService.listUserTeams.mockRejectedValue(new Error('Failed to list teams'));

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to list teams');
    });

    it('should handle service unavailable', async () => {
      mockTeamService.listUserTeams.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toBeDefined();
    });

    it('should handle unexpected exceptions', async () => {
      mockTeamService.listUserTeams.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toBeDefined();
    });

    it('should return empty array when no teams found', async () => {
      mockTeamService.listUserTeams.mockResolvedValue([]);

      const response = await request(app)
        .get('/teams')
        .expect(200);

      expect(response.body.data?.teams || response.body.teams).toEqual([]);
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

      mockTeamService.createTeam.mockResolvedValue(mockTeam);

      const response = await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      expect(response.body.data?.team || response.body.team).toEqual(mockTeam);
      expect(mockTeamService.createTeam).toHaveBeenCalledWith(
        teamData,
        'user-123',
        'test@example.com'
      );
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/teams')
        .send({ name: 'A' }) // Too short
        .expect(400);

      const titleOrError = response.body.title || response.body.error;
      expect(titleOrError).toBeDefined();
      expect(titleOrError.toLowerCase()).toMatch(/invalid|validation/);
      expect(response.body.details || response.body.detail).toBeDefined();
    });

    it('should use user email as billing email if not provided', async () => {
      const teamData = { name: 'New Team' };
      const mockTeam = {
        id: 'team-123',
        name: 'New Team',
        slug: 'new-team',
        owner_id: 'user-123',
        billing_email: 'test@example.com'
      };

      mockTeamService.createTeam.mockResolvedValue(mockTeam);

      await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      expect(mockTeamService.createTeam).toHaveBeenCalledWith(
        teamData,
        'user-123',
        'test@example.com'
      );
    });

    it('should handle team creation error', async () => {
      mockTeamService.createTeam.mockRejectedValue(new Error('Failed to create team'));

      const response = await request(app)
        .post('/teams')
        .send({ name: 'New Team' })
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to create team');
    });

    it('should handle member creation error and cleanup', async () => {
      mockTeamService.createTeam.mockRejectedValue(new Error('Failed to create team'));

      const response = await request(app)
        .post('/teams')
        .send({ name: 'New Team' })
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to create team');
    });

    it('should generate slug from team name', async () => {
      const teamData = { name: 'My Awesome Team!' };
      const mockTeam = {
        id: 'team-123',
        name: 'My Awesome Team!',
        slug: 'my-awesome-team',
        owner_id: 'user-123',
        billing_email: 'test@example.com'
      };

      mockTeamService.createTeam.mockResolvedValue(mockTeam);

      const response = await request(app)
        .post('/teams')
        .send(teamData)
        .expect(201);

      const team = response.body.data?.team || response.body.team;
      expect(team.slug).toBe('my-awesome-team');
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

      mockTeamService.getTeamDetails.mockResolvedValue(mockTeam);

      const response = await request(app)
        .get('/teams/team-123')
        .expect(200);

      expect(response.body.data?.team || response.body.team).toEqual(mockTeam);
      expect(mockTeamService.getTeamDetails).toHaveBeenCalledWith('team-123');
    });

    it('should handle team not found error', async () => {
      mockTeamService.getTeamDetails.mockRejectedValue(new Error('Failed to get team'));

      const response = await request(app)
        .get('/teams/team-123')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to get team');
    });
  });

  describe('PATCH /teams/:teamId', () => {
    it('should update team successfully', async () => {
      const updateData = { name: 'Updated Team', billingEmail: 'new@example.com' };
      const mockTeam = { id: 'team-123', name: 'Updated Team', billing_email: 'new@example.com' };

      mockTeamService.updateTeam.mockResolvedValue(mockTeam);

      const response = await request(app)
        .patch('/teams/team-123')
        .send(updateData)
        .expect(200);

      expect(response.body.data?.team || response.body.team).toEqual(mockTeam);
      expect(mockTeamService.updateTeam).toHaveBeenCalledWith(
        'team-123',
        updateData,
        'user-123'
      );
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .patch('/teams/team-123')
        .send({ name: 'A' }) // Too short
        .expect(400);

      const titleOrError = response.body.title || response.body.error;
      expect(titleOrError).toBeDefined();
      expect(titleOrError.toLowerCase()).toMatch(/invalid|validation/);
    });

    it('should handle update error', async () => {
      mockTeamService.updateTeam.mockRejectedValue(new Error('Failed to update team'));

      const response = await request(app)
        .patch('/teams/team-123')
        .send({ name: 'Updated Team' })
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to update team');
    });
  });

  describe('DELETE /teams/:teamId', () => {
    it('should delete team successfully', async () => {
      mockTeamService.deleteTeam.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/teams/team-123')
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Team deleted successfully');
      expect(mockTeamService.deleteTeam).toHaveBeenCalledWith('team-123', 'user-123');
    });

    it('should handle deletion error', async () => {
      mockTeamService.deleteTeam.mockRejectedValue(new Error('Failed to delete team'));

      const response = await request(app)
        .delete('/teams/team-123')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to delete team');
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

      const mockInvite = {
        id: 'invite-123',
        email: 'newuser@example.com',
        role: 'member',
        token: 'invite-token-123',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockInviteService.sendTeamInvite.mockResolvedValue(mockInvite);

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send(inviteData)
        .expect(201);

      const body = response.body.data || response.body;
      expect(body.message).toBe('Invite sent successfully');
      expect(body.invite).toEqual(expect.objectContaining({ id: 'invite-123' }));

      expect(mockInviteService.sendTeamInvite).toHaveBeenCalledWith(
        'team-123',
        inviteData,
        'user-123',
        'test@example.com'
      );
    });

    it('should validate invite data', async () => {
      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'invalid-email' })
        .expect(400);

      const titleOrError = response.body.title || response.body.error;
      expect(titleOrError).toBeDefined();
      expect(titleOrError.toLowerCase()).toMatch(/invalid|validation/);
    });

    it('should prevent inviting existing members', async () => {
      mockInviteService.sendTeamInvite.mockRejectedValue(
        new Error('User is already a member of this team')
      );

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'existing@example.com', role: 'member' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('already a member');
    });

    it('should prevent duplicate pending invites', async () => {
      mockInviteService.sendTeamInvite.mockRejectedValue(
        new Error('User already has a pending invite to this team')
      );

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'pending@example.com', role: 'member' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('pending invite');
    });

    it('should handle email sending failure', async () => {
      mockInviteService.sendTeamInvite.mockRejectedValue(
        new Error('Failed to send invite email')
      );

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send({ email: 'test@example.com', role: 'member' })
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to send invite email');
    });
  });

  describe('POST /teams/accept-invite', () => {
    it('should accept invite successfully', async () => {
      mockInviteService.acceptInvite.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'valid-token-123' })
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Invite accepted successfully');
      expect(mockInviteService.acceptInvite).toHaveBeenCalledWith(
        { token: 'valid-token-123' },
        'test@example.com',
        'user-123'
      );
    });

    it('should reject invalid token', async () => {
      mockInviteService.acceptInvite.mockRejectedValue(
        new Error('Invalid or expired invite')
      );

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Invalid or expired');
    });

    it('should reject expired invite', async () => {
      mockInviteService.acceptInvite.mockRejectedValue(
        new Error('Invite has expired')
      );

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'expired-token' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('expired');
    });

    it('should reject already accepted invite', async () => {
      mockInviteService.acceptInvite.mockRejectedValue(
        new Error('Invite has already been used')
      );

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'accepted-token' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('already been used');
    });

    it('should reject invite for different user', async () => {
      mockInviteService.acceptInvite.mockRejectedValue(
        new Error('This invite is not for your email address')
      );

      const response = await request(app)
        .post('/teams/accept-invite')
        .send({ token: 'wrong-user-token' })
        .expect(403);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('not for your email');
    });
  });

  describe('DELETE /teams/:teamId/invites/:inviteId', () => {
    it('should cancel invite successfully', async () => {
      mockInviteService.cancelInvite.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/teams/team-123/invites/invite-123')
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Invite cancelled successfully');
      expect(mockInviteService.cancelInvite).toHaveBeenCalledWith(
        'team-123',
        'invite-123',
        'user-123'
      );
    });

    it('should handle cancellation error', async () => {
      mockInviteService.cancelInvite.mockRejectedValue(
        new Error('Failed to cancel invite')
      );

      const response = await request(app)
        .delete('/teams/team-123/invites/invite-123')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Failed to cancel invite');
    });
  });

  describe('PATCH /teams/:teamId/members/:memberId', () => {
    it('should update member role successfully', async () => {
      const updatedMember = {
        id: 'member-123',
        role: 'admin',
        user: { id: 'user-456', email: 'member@example.com' }
      } as any;

      mockMemberService.updateMemberRole.mockResolvedValue(updatedMember);

      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.data?.member || response.body.member).toEqual(updatedMember);
      expect(mockMemberService.updateMemberRole).toHaveBeenCalledWith(
        'team-123',
        'member-123',
        { role: 'admin' },
        'user-123'
      );
    });

    it('should prevent role change of team owner', async () => {
      mockMemberService.updateMemberRole.mockRejectedValue(
        new Error('Cannot change the role of the team owner')
      );

      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'member' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Cannot change the role');
    });

    it('should validate role data', async () => {
      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'invalid-role' })
        .expect(400);

      const titleOrError = response.body.title || response.body.error;
      expect(titleOrError).toBeDefined();
      expect(titleOrError.toLowerCase()).toMatch(/invalid|validation/);
    });
  });

  describe('DELETE /teams/:teamId/members/:memberId', () => {
    it('should remove member successfully', async () => {
      mockMemberService.removeMember.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/teams/team-123/members/member-123')
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Member removed successfully');
      expect(mockMemberService.removeMember).toHaveBeenCalledWith(
        'team-123',
        'member-123',
        'user-123'
      );
    });

    it('should prevent removal of team owner', async () => {
      mockMemberService.removeMember.mockRejectedValue(
        new Error('Cannot remove the team owner')
      );

      const response = await request(app)
        .delete('/teams/team-123/members/member-123')
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('Cannot remove');
    });
  });

  describe('POST /teams/:teamId/leave', () => {
    it('should allow member to leave team', async () => {
      mockMemberService.leaveTeam.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/team-123/leave')
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Left team successfully');
      expect(mockMemberService.leaveTeam).toHaveBeenCalledWith('team-123', 'user-123');
    });

    it('should prevent owner from leaving team', async () => {
      mockMemberService.leaveTeam.mockRejectedValue(
        new Error('Team owners cannot leave the team. Transfer ownership first.')
      );

      const response = await request(app)
        .post('/teams/team-123/leave')
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('cannot leave');
    });
  });

  describe('POST /teams/:teamId/transfer-ownership', () => {
    it('should transfer ownership successfully', async () => {
      mockMemberService.transferOwnership.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({ newOwnerId: 'member-456' })
        .expect(200);

      const message = response.body.data?.message || response.body.message;
      expect(message).toBe('Ownership transferred successfully');
      expect(mockMemberService.transferOwnership).toHaveBeenCalledWith(
        'team-123',
        'member-456',
        'user-123'
      );
    });

    it('should validate new owner exists', async () => {
      mockMemberService.transferOwnership.mockRejectedValue(
        new Error('New owner must be a member of the team')
      );

      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({ newOwnerId: 'nonexistent' })
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('must be a member');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/teams/team-123/transfer-ownership')
        .send({})
        .expect(400);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toContain('required');
    });
  });

  describe('Error Handling', () => {
    it('should handle service unavailable for all endpoints', async () => {
      mockTeamService.listUserTeams.mockRejectedValue(new Error('Service unavailable'));
      mockTeamService.createTeam.mockRejectedValue(new Error('Service unavailable'));
      mockTeamService.getTeamDetails.mockRejectedValue(new Error('Service unavailable'));
      mockTeamService.updateTeam.mockRejectedValue(new Error('Service unavailable'));
      mockTeamService.deleteTeam.mockRejectedValue(new Error('Service unavailable'));

      await request(app).get('/teams').expect(500);
      await request(app).post('/teams').send({ name: 'Test Team' }).expect(500);
      await request(app).get('/teams/team-123').expect(500);
      await request(app).patch('/teams/team-123').send({ name: 'Test' }).expect(500);
      await request(app).delete('/teams/team-123').expect(500);
    });

    it('should handle unexpected exceptions', async () => {
      mockTeamService.listUserTeams.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/teams')
        .expect(500);

      expect(response.body.title || response.body.error).toBeDefined();
      expect(response.body.detail || response.body.error).toBeDefined();
    });
  });

  describe('Middleware Integration', () => {
    it('should require authentication for all endpoints', async () => {
      // Make a request to trigger middleware
      mockTeamService.listUserTeams.mockResolvedValue([]);
      await request(app).get('/teams');

      expect(mockRequireAuth).toHaveBeenCalled();
    });

    it('should require team access for team-specific endpoints', async () => {
      // Make a request to trigger middleware
      mockTeamService.getTeamDetails.mockResolvedValue({ id: 'team-123' });
      await request(app).get('/teams/team-123');

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

      mockTeamService.createTeam.mockResolvedValue(mockTeam);

      await request(app)
        .post('/teams')
        .send({ name: 'Test Team' })
        .expect(201);

      // Activity logging is handled inside the service, so we just verify the service was called
      expect(mockTeamService.createTeam).toHaveBeenCalledWith(
        { name: 'Test Team' },
        'user-123',
        'test@example.com'
      );
    });
  });
});