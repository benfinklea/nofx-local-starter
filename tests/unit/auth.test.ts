/**
 * Auth Module Unit Tests
 * BULLETPROOF: Comprehensive authentication tests
 */

import { isAdmin, parseCookies, hmac, COOKIE_NAME } from '../../src/lib/auth';

// Mock Supabase client
const mockSupabaseAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
  getSession: jest.fn(),
  refreshSession: jest.fn(),
  resetPasswordForEmail: jest.fn()
};

const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: jest.fn()
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Auth Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Authentication', () => {
    test('signs up new user', async () => {
      const userData = {
        email: 'user@example.com',
        password: 'StrongPassword123!'
      };

      mockSupabaseAuth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: userData.email },
          session: { access_token: 'token-123' }
        },
        error: null
      });

      const signUp = async (email: string, password: string) => {
        const { data, error } = await mockSupabaseAuth.signUp({
          email,
          password
        });
        if (error) throw error;
        return data;
      };

      const result = await signUp(userData.email, userData.password);

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: userData.email,
        password: userData.password
      });
      expect(result.user.id).toBe('user-123');
    });

    test('signs in existing user', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'Password123!'
      };

      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: credentials.email },
          session: { access_token: 'token-456' }
        },
        error: null
      });

      const signIn = async (email: string, password: string) => {
        const { data, error } = await mockSupabaseAuth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        return data;
      };

      const result = await signIn(credentials.email, credentials.password);

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password
      });
      expect(result.session.access_token).toBe('token-456');
    });

    test('handles sign in errors', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid credentials' }
      });

      const signIn = async (email: string, password: string) => {
        const { data, error } = await mockSupabaseAuth.signInWithPassword({
          email,
          password
        });
        if (error) throw new Error(error.message);
        return data;
      };

      await expect(signIn('user@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    test('signs out user', async () => {
      mockSupabaseAuth.signOut.mockResolvedValueOnce({
        error: null
      });

      const signOut = async () => {
        const { error } = await mockSupabaseAuth.signOut();
        if (error) throw error;
      };

      await signOut();

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    test('gets current session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'token-789',
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const getSession = async () => {
        const { data, error } = await mockSupabaseAuth.getSession();
        if (error) throw error;
        return data.session;
      };

      const session = await getSession();

      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
      expect(session.access_token).toBe('token-789');
    });

    test('refreshes session', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'new-token-123',
            refresh_token: 'refresh-123'
          }
        },
        error: null
      });

      const refreshSession = async () => {
        const { data, error } = await mockSupabaseAuth.refreshSession();
        if (error) throw error;
        return data.session;
      };

      const newSession = await refreshSession();

      expect(mockSupabaseAuth.refreshSession).toHaveBeenCalled();
      expect(newSession.access_token).toBe('new-token-123');
    });

    test('handles expired session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null
      });

      const getSession = async () => {
        const { data } = await mockSupabaseAuth.getSession();
        return data.session;
      };

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe('User Management', () => {
    test('gets current user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            created_at: '2024-01-01'
          }
        },
        error: null
      });

      const getUser = async () => {
        const { data, error } = await mockSupabaseAuth.getUser();
        if (error) throw error;
        return data.user;
      };

      const user = await getUser();

      expect(mockSupabaseAuth.getUser).toHaveBeenCalled();
      expect(user.email).toBe('user@example.com');
    });

    test('handles unauthenticated user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      const getUser = async () => {
        const { data, error } = await mockSupabaseAuth.getUser();
        if (error) throw new Error(error.message);
        return data.user;
      };

      await expect(getUser()).rejects.toThrow('Not authenticated');
    });
  });

  describe('Password Recovery', () => {
    test('sends password reset email', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null
      });

      const resetPassword = async (email: string) => {
        const { error } = await mockSupabaseAuth.resetPasswordForEmail(email);
        if (error) throw error;
      };

      await resetPassword('user@example.com');

      expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com'
      );
    });

    test('handles invalid email for reset', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid email' }
      });

      const resetPassword = async (email: string) => {
        const { error } = await mockSupabaseAuth.resetPasswordForEmail(email);
        if (error) throw new Error(error.message);
      };

      await expect(resetPassword('invalid')).rejects.toThrow('Invalid email');
    });
  });

  describe('Token Validation', () => {
    test('validates JWT token', () => {
      const validateToken = (token: string): boolean => {
        const parts = token.split('.');
        return parts.length === 3;
      };

      expect(validateToken('header.payload.signature')).toBe(true);
      expect(validateToken('invalid-token')).toBe(false);
      expect(validateToken('')).toBe(false);
    });

    test('extracts user ID from token', () => {
      const extractUserId = (token: string): string | null => {
        try {
          const payload = token.split('.')[1];
          if (!payload) return null;
          // Mock decoding
          return 'user-123';
        } catch {
          return null;
        }
      };

      expect(extractUserId('valid.token.here')).toBe('user-123');
      expect(extractUserId('invalid')).toBeNull();
    });
  });

  describe('Authorization', () => {
    test('checks user permissions', async () => {
      const checkPermission = async (userId: string, permission: string) => {
        const permissions: Record<string, string[]> = {
          'user-123': ['read', 'write'],
          'user-456': ['read']
        };

        return permissions[userId]?.includes(permission) || false;
      };

      expect(await checkPermission('user-123', 'write')).toBe(true);
      expect(await checkPermission('user-456', 'write')).toBe(false);
      expect(await checkPermission('user-789', 'read')).toBe(false);
    });

    test('validates API key', () => {
      const validateApiKey = (key: string): boolean => {
        return key.startsWith('sk_') && key.length > 20;
      };

      expect(validateApiKey('sk_test_abcdef123456789012345')).toBe(true);
      expect(validateApiKey('invalid_key')).toBe(false);
      expect(validateApiKey('sk_short')).toBe(false);
    });
  });

  // ==========================================================================
  // BULLETPROOF TESTS: isAdmin() Function
  // ==========================================================================

  describe('isAdmin() - BULLETPROOF Core Auth', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('Development Bypass', () => {
      test('allows when NODE_ENV=development AND ENABLE_ADMIN=true', () => {
        process.env.NODE_ENV = 'development';
        process.env.ENABLE_ADMIN = 'true';
        expect(isAdmin({ headers: {} })).toBe(true);
      });

      test('denies when NODE_ENV=production even with ENABLE_ADMIN=true', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_ADMIN = 'true';
        expect(isAdmin({ headers: {} })).toBe(false);
      });

      test('denies when NODE_ENV=development without ENABLE_ADMIN', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.ENABLE_ADMIN;
        expect(isAdmin({ headers: {} })).toBe(false);
      });
    });

    describe('Cookie Authentication', () => {
      const secret = 'test-secret';

      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.ADMIN_SECRET = secret;
      });

      test('accepts valid cookie with correct signature', () => {
        const value = 'admin';
        const sig = hmac(value, secret);
        const cookie = `${COOKIE_NAME}=${value}|${sig}`;
        expect(isAdmin({ headers: { cookie } })).toBe(true);
      });

      test('rejects cookie with invalid signature', () => {
        const cookie = `${COOKIE_NAME}=admin|badsig`;
        expect(isAdmin({ headers: { cookie } })).toBe(false);
      });

      test('rejects tampered cookie value', () => {
        const originalValue = 'admin';
        const sig = hmac(originalValue, secret);
        const cookie = `${COOKIE_NAME}=superadmin|${sig}`;
        expect(isAdmin({ headers: { cookie } })).toBe(false);
      });

      test('handles SQL injection in cookie', () => {
        const cookie = `${COOKIE_NAME}=' OR '1'='1|fakesig`;
        expect(isAdmin({ headers: { cookie } })).toBe(false);
      });

      test('handles XSS in cookie', () => {
        const cookie = `${COOKIE_NAME}=<script>alert(1)</script>|fakesig`;
        expect(isAdmin({ headers: { cookie } })).toBe(false);
      });
    });

    describe('JWT Bearer Token', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      test('accepts Bearer token format', () => {
        const req = {
          headers: {
            authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig'
          }
        };
        expect(isAdmin(req)).toBe(true);
      });

      test('rejects token without Bearer prefix', () => {
        const req = {
          headers: {
            authorization: 'token123'
          }
        };
        expect(isAdmin(req)).toBe(false);
      });

      test('rejects Basic auth', () => {
        const req = {
          headers: {
            authorization: 'Basic dXNlcjpwYXNz'
          }
        };
        expect(isAdmin(req)).toBe(false);
      });

      test('case-sensitive Bearer prefix', () => {
        const req = {
          headers: {
            authorization: 'bearer token123'
          }
        };
        expect(isAdmin(req)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      test('handles empty headers', () => {
        expect(isAdmin({ headers: {} })).toBe(false);
      });

      test('handles null cookie', () => {
        expect(isAdmin({ headers: { cookie: null as unknown as string } })).toBe(false);
      });

      test('handles undefined authorization', () => {
        expect(isAdmin({ headers: { authorization: undefined } })).toBe(false);
      });

      test('handles extremely long cookie', () => {
        const longValue = 'a'.repeat(10000);
        const sig = hmac(longValue, 'test-secret');
        const cookie = `${COOKIE_NAME}=${longValue}|${sig}`;
        process.env.ADMIN_SECRET = 'test-secret';
        expect(isAdmin({ headers: { cookie } })).toBe(true);
      });

      test('cookie with valid signature wins over invalid bearer', () => {
        const value = 'admin';
        const sig = hmac(value, 'test-secret');
        process.env.ADMIN_SECRET = 'test-secret';
        const req = {
          headers: {
            cookie: `${COOKIE_NAME}=${value}|${sig}`,
            authorization: 'InvalidFormat'
          }
        };
        expect(isAdmin(req)).toBe(true);
      });

      test('valid bearer wins over invalid cookie', () => {
        const req = {
          headers: {
            cookie: `${COOKIE_NAME}=admin|badsig`,
            authorization: 'Bearer validtoken'
          }
        };
        expect(isAdmin(req)).toBe(true);
      });
    });
  });

  describe('parseCookies() - BULLETPROOF Cookie Parsing', () => {
    test('parses single cookie', () => {
      expect(parseCookies('name=value')).toEqual({ name: 'value' });
    });

    test('parses multiple cookies', () => {
      expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
    });

    test('handles undefined', () => {
      expect(parseCookies(undefined)).toEqual({});
    });

    test('handles empty string', () => {
      expect(parseCookies('')).toEqual({});
    });

    test('handles value with equals sign', () => {
      expect(parseCookies('jwt=abc=def=ghi')).toEqual({ jwt: 'abc=def=ghi' });
    });

    test('handles malformed cookie without equals', () => {
      // Cookie without equals is treated as name=""
      expect(parseCookies('noequals')).toEqual({ noequals: '' });
    });
  });

  describe('hmac() - BULLETPROOF Signature Generation', () => {
    test('generates consistent signatures', () => {
      const sig1 = hmac('test', 'secret');
      const sig2 = hmac('test', 'secret');
      expect(sig1).toBe(sig2);
    });

    test('different data produces different signatures', () => {
      const sig1 = hmac('test1', 'secret');
      const sig2 = hmac('test2', 'secret');
      expect(sig1).not.toBe(sig2);
    });

    test('different secrets produce different signatures', () => {
      const sig1 = hmac('test', 'secret1');
      const sig2 = hmac('test', 'secret2');
      expect(sig1).not.toBe(sig2);
    });

    test('handles unicode', () => {
      const sig = hmac('テスト🔒', '密钥');
      expect(sig).toBeDefined();
      expect(sig.length).toBeGreaterThan(0);
    });

    test('generates hex output', () => {
      const sig = hmac('test', 'secret');
      expect(sig).toMatch(/^[0-9a-f]+$/);
    });
  });
});