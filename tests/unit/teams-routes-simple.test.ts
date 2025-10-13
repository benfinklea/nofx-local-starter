/**
 * Simplified comprehensive tests for src/api/routes/teams.ts
 * Testing all major endpoints with good coverage and proper type safety
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

// ============================================================================
// Type-Safe Mock Definitions
// ============================================================================

/**
 * Supabase client chainable query builder mock type
 */
interface MockSupabaseChainable {
  from: jest.MockedFunction<(table: string) => MockSupabaseChainable>;
  select: jest.MockedFunction<(columns?: string) => MockSupabaseChainable>;
  insert: jest.MockedFunction<(data: any) => MockSupabaseChainable>;
  update: jest.MockedFunction<(data: any) => MockSupabaseChainable>;
  delete: jest.MockedFunction<() => MockSupabaseChainable>;
  eq: jest.MockedFunction<(column: string, value: any) => MockSupabaseChainable | Promise<any>>;
  order: jest.MockedFunction<(column: string, options?: any) => MockSupabaseChainable | Promise<any>>;
  single: jest.MockedFunction<() => MockSupabaseChainable | Promise<any>>;
  then: jest.MockedFunction<(resolve: (value: any) => void) => Promise<any>>;
  catch: jest.MockedFunction<(reject?: (reason: any) => void) => Promise<any>>;
}

/**
 * Type-safe middleware mock
 */
type MockMiddleware = jest.MockedFunction<(req: Request, res: Response, next: NextFunction) => void>;

/**
 * Type-safe middleware factory mock
 */
type MockMiddlewareFactory = jest.MockedFunction<() => MockMiddleware>;

// ============================================================================
// Mock Setup
// ============================================================================

// Mock dependencies before importing
jest.mock('../../src/auth/supabase', () => ({
  createServiceClient: jest.fn()
}));

jest.mock('../../src/auth/middleware', () => {
  const mockRequireAuth: MockMiddleware = jest.fn((req: any, res: any, next: any) => next());
  const mockRequireTeamAccess: MockMiddlewareFactory = jest.fn(() => (req: any, res: any, next: any) => next());

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

// ============================================================================
// Import Mocked Dependencies
// ============================================================================

import teamsMount from '../../src/api/routes/teams';
import { createServiceClient } from '../../src/auth/supabase';
import { sendTeamInviteEmail } from '../../src/services/email/teamEmails';

// Type assertions for mocked functions
const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>;
const mockSendTeamInviteEmail = sendTeamInviteEmail as jest.MockedFunction<typeof sendTeamInviteEmail>;

describe('Teams Routes', () => {
  let app: Express;
  let mockSupabase: MockSupabaseChainable;

  /**
   * Helper to create a properly typed Supabase chainable mock
   * The mock supports both method chaining and promise-based operations
   */
  const createChainableMock = (): MockSupabaseChainable => {
    const chainable = {} as MockSupabaseChainable;

    // Chainable methods that return the chainable object itself
    chainable.from = jest.fn(() => chainable) as jest.MockedFunction<(table: string) => MockSupabaseChainable>;
    chainable.select = jest.fn(() => chainable) as jest.MockedFunction<(columns?: string) => MockSupabaseChainable>;
    chainable.insert = jest.fn(() => chainable) as jest.MockedFunction<(data: any) => MockSupabaseChainable>;
    chainable.update = jest.fn(() => chainable) as jest.MockedFunction<(data: any) => MockSupabaseChainable>;
    chainable.delete = jest.fn(() => chainable) as jest.MockedFunction<() => MockSupabaseChainable>;
    chainable.eq = jest.fn(() => chainable) as jest.MockedFunction<(column: string, value: any) => MockSupabaseChainable>;
    chainable.order = jest.fn(() => chainable) as jest.MockedFunction<(column: string, options?: any) => MockSupabaseChainable>;
    chainable.single = jest.fn(() => chainable) as jest.MockedFunction<() => MockSupabaseChainable>;

    // Make it thenable (awaitable) - default implementation
    chainable.then = jest.fn((resolve: (value: any) => void) => {
      const result = { data: null, error: null };
      if (resolve) resolve(result);
      return Promise.resolve(result);
    }) as jest.MockedFunction<(resolve: (value: any) => void) => Promise<any>>;

    chainable.catch = jest.fn(() => Promise.resolve({ data: null, error: null })) as jest.MockedFunction<(reject?: (reason: any) => void) => Promise<any>>;

    return chainable;
  };

  beforeEach(() => {
    app = express() as Express;
    app.use(express.json());

    // Add middleware to set user context with proper typing
    app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).userId = 'user-123';
      (req as any).user = { email: 'test@example.com', id: 'user-123' };
      next();
    });

    // Create a comprehensive Supabase mock with proper typing
    mockSupabase = createChainableMock();

    // Reset and configure the createServiceClient mock
    mockCreateServiceClient.mockReset();
    mockCreateServiceClient.mockReturnValue(mockSupabase as any);

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

      // Mock the then() method to return the team data for the first call (create team)
      (mockSupabase.then as jest.Mock)
        .mockImplementationOnce((resolve: Function) => {
          const result = { data: mockTeam, error: null };
          if (resolve) resolve(result);
          return Promise.resolve(result);
        })
        // Second call: add team member (returns success)
        .mockImplementationOnce((resolve: Function) => {
          const result = { data: null, error: null };
          if (resolve) resolve(result);
          return Promise.resolve(result);
        })
        // Third call: activity log (returns success)
        .mockImplementationOnce((resolve: Function) => {
          const result = { data: null, error: null };
          if (resolve) resolve(result);
          return Promise.resolve(result);
        });

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
      const mockTeam = { id: 'team-123', name: 'Updated Team', billing_email: 'new@example.com' };

      // Mock for: .update().eq().select().single() - returns updated team
      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });
      // Mock for: .insert() - activity log
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
  });

  describe('DELETE /teams/:teamId', () => {
    it('should delete team successfully', async () => {
      // Mock for: .delete().eq() - delete operation
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });
      // Mock for: .insert() - activity log
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

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

      // 1. Team lookup: .from('teams').select('id, name').eq('id', teamId).single()
      // .eq() must return chainable, .single() resolves
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // .eq('id') returns chainable
      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null }); // .single() resolves

      // 2. User lookup: .from('users').select('id').eq('email', email) - ONE .eq() call, awaited directly
      mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null });

      // 3. Member check: .from('team_members').select('id').eq('team_id').eq('user_id') - TWO .eq() calls
      // (Skipped because user doesn't exist, so validateNotExistingMember returns early)

      // 4. Pending invite check: .from('team_invites').select('id').eq('team_id').eq('email').eq('status') - THREE .eq() calls
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('team_id')
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // Second .eq('email')
      mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // Third .eq('status') resolves

      // 5. Invite creation: .from('team_invites').insert({...}).select().single()
      mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null });

      // 6. Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

      mockSendTeamInviteEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send(inviteData);

      // Log the response for debugging
      if (response.status !== 201) {
        console.log('Response status:', response.status);
        console.log('Response body:', response.body);
      }

      expect(response.status).toBe(201);
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
      const existingUser = { id: 'user-456' };
      const existingMember = { id: 'member-123', role: 'member' };

      // 1. Team lookup: .from('teams').select('id, name').eq('id', teamId).single()
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // .eq('id') returns chainable
      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null }); // .single() resolves

      // 2. User lookup by email: .from('users').select('id').eq('email') - 1 .eq() call
      mockSupabase.eq.mockResolvedValueOnce({ data: [existingUser], error: null });

      // 3. Member check: .from('team_members').select('id').eq('team_id').eq('user_id') - 2 .eq() calls
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // .eq('team_id') returns chainable
      mockSupabase.eq.mockResolvedValueOnce({ data: [existingMember], error: null }); // .eq('user_id') returns result

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

      // 1. Invite lookup: .from('team_invites').select('*').eq('token').single()
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // .eq('token') returns chainable
      mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null }); // .single() resolves

      // 2. Member insertion: .from('team_members').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

      // 3. Invite update: .from('team_invites').update({...}).eq('id')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null });

      // 4. Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

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
      // Cancel invite: .from('team_invites').update({status: 'cancelled'}).eq('id').eq('team_id')
      // TWO .eq() calls
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('id')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null }); // Second .eq('team_id') resolves

      // Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

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
        role: 'member',
        user: { id: 'user-456', email: 'member@example.com' }
      };
      const updatedMember = {
        id: 'member-123',
        role: 'admin',
        user: { id: 'user-456', email: 'member@example.com' }
      };

      // Mock get current member: .select().eq().eq().single()
      mockSupabase.single.mockResolvedValueOnce({ data: mockMember, error: null });

      // Mock update member: .update().eq().eq().select().single()
      mockSupabase.single.mockResolvedValueOnce({ data: updatedMember, error: null });

      // Mock activity log: .insert()
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .patch('/teams/team-123/members/member-123')
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body).toEqual({ member: updatedMember });
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

      // 1. Get member: .from('team_members').select(...).eq('id').eq('team_id').single()
      // TWO .eq() calls before .single()
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('id')
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // Second .eq('team_id')
      mockSupabase.single.mockResolvedValueOnce({ data: mockMember, error: null }); // .single() resolves

      // 2. Delete member: .from('team_members').delete().eq('id').eq('team_id')
      // TWO .eq() calls
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('id')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null }); // Second .eq('team_id') resolves

      // 3. Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

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
      // 1. Check membership: .from('team_members').select('id, role').eq('team_id').eq('user_id')
      // TWO .eq() calls, then await
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 1) {
          // First .eq('team_id') - return chainable
          return mockSupabase;
        } else if (eqCallCount === 2) {
          // Second .eq('user_id') - resolve with member data
          return Promise.resolve({ data: [{ id: 'member-123', role: 'member' }], error: null });
        } else if (eqCallCount === 3) {
          // Delete: .from('team_members').delete().eq('team_id') - return chainable
          return mockSupabase;
        } else {
          // Delete: .eq('user_id') - resolve
          return Promise.resolve({ data: null, error: null });
        }
      });

      // 2. Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
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

      // Check membership: .from('team_members').select('id, role').eq('team_id').eq('user_id')
      // TWO .eq() calls
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('team_id')
      mockSupabase.eq.mockResolvedValueOnce({ data: [ownerMembership], error: null }); // Second .eq('user_id')

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

      // 1. Validate new owner: .from('team_members').select(...).eq('id').eq('team_id').single()
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('id')
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // Second .eq('team_id')
      mockSupabase.single.mockResolvedValueOnce({ data: newOwner, error: null }); // .single() resolves

      // 2. Update new owner: .from('team_members').update({...}).eq('id').eq('team_id')
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('id')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null }); // Second .eq('team_id') resolves

      // 3. Update current owner: .from('team_members').update({...}).eq('user_id').eq('team_id')
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq('user_id')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null }); // Second .eq('team_id') resolves

      // 4. Activity log: .from('team_activity_logs').insert({...})
      (mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });

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