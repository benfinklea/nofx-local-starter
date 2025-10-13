/**
 * Debug test to see actual errors
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
import type { Express } from 'express';

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>;

describe('Debug Teams Routes', () => {
  let app: Express;
  let mockSupabase: any;

  beforeEach(() => {
    app = express() as Express;
    app.use(express.json());

    // Add middleware to set user context
    app.use((req: any, res, next) => {
      req.userId = 'user-123';
      req.user = { email: 'test@example.com', id: 'user-123' };
      next();
    });

    // Create a comprehensive Supabase mock
    const createChainableMock = () => {
      const chainable: any = {};

      chainable.from = jest.fn(() => chainable);
      chainable.select = jest.fn(() => chainable);
      chainable.insert = jest.fn(() => chainable);
      chainable.update = jest.fn(() => chainable);
      chainable.delete = jest.fn(() => chainable);
      chainable.eq = jest.fn(() => chainable);
      chainable.order = jest.fn(() => chainable);
      chainable.single = jest.fn(() => chainable);

      chainable.then = jest.fn((resolve: Function) => {
        const result = { data: null, error: null };
        if (resolve) resolve(result);
        return Promise.resolve(result);
      });
      chainable.catch = jest.fn(() => Promise.resolve({ data: null, error: null }));

      return chainable;
    };

    mockSupabase = createChainableMock();
    mockCreateServiceClient.mockReset();
    mockCreateServiceClient.mockReturnValue(mockSupabase);

    // Mount routes
    teamsMount(app);
  });

  describe('POST /teams/:teamId/invites', () => {
    it('should check if createServiceClient is being called correctly', () => {
      // Verify mock setup
      const result = mockCreateServiceClient();
      expect(result).toBeTruthy();
      expect(result.from).toBeDefined();
    });

    it('should send invite - see actual error', async () => {
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
        token: 'test-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Verify the mock is working
      expect(mockCreateServiceClient()).toBeTruthy();

      // Mock for team lookup: .from('teams').select().eq().single()
      mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });

      // Mock for user lookup: .from('users').select().eq() - no existing user
      mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null });

      // Mock for pending invite check: .from('team_invites').select().eq().eq().eq() - no pending
      mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null });

      // Mock for invite creation: .from('team_invites').insert().select().single()
      mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null });

      // Mock for activity log: .from('team_activity_logs').insert()
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .post('/teams/team-123/invites')
        .send(inviteData);

      // Log the response for debugging
      if (response.status !== 201) {
        // Use stderr to force output
        process.stderr.write(`Status: ${response.status}\n`);
        process.stderr.write(`Body: ${JSON.stringify(response.body, null, 2)}\n`);
      }

      expect(response.status).toBe(201);
    });
  });
});
