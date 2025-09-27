/**
 * Authentication service for frontend
 * Uses server-side auth endpoints instead of direct Supabase client
 */

import { apiBase } from '../config';

interface User {
  id: string;
  email?: string;
  user_metadata?: any;
}

interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface AuthResponse {
  user?: User;
  session?: Session;
  message?: string;
  error?: string;
}

class AuthService {
  private user: User | null = null;
  private session: Session | null = null;

  constructor() {
    // Try to restore session from localStorage
    this.restoreSession();
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = apiBase ? `${apiBase}${endpoint}` : endpoint;

    const headers = new Headers(options.headers);

    // Add auth token if available
    if (this.session?.access_token) {
      headers.set('Authorization', `Bearer ${this.session.access_token}`);
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    });
  }

  private restoreSession() {
    try {
      const storedSession = localStorage.getItem('auth_session');
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        this.session = parsed.session;
        this.user = parsed.user;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  }

  private saveSession(user: User | null, session: Session | null) {
    this.user = user;
    this.session = session;

    if (user && session) {
      localStorage.setItem('auth_session', JSON.stringify({ user, session }));
    } else {
      localStorage.removeItem('auth_session');
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.request('/api/auth-v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Login failed' };
      }

      this.saveSession(data.user, data.session);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Network error during login' };
    }
  }

  async signup(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    try {
      const response = await this.request('/api/auth-v2/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Signup failed' };
      }

      // If auto-confirmed, save session
      if (data.session) {
        this.saveSession(data.user, data.session);
      }

      return data;
    } catch (error) {
      console.error('Signup error:', error);
      return { error: 'Network error during signup' };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth-v2/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.saveSession(null, null);
    }
  }

  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const response = await this.request('/api/auth-v2/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Password reset failed' };
      }

      return data;
    } catch (error) {
      console.error('Password reset error:', error);
      return { error: 'Network error during password reset' };
    }
  }

  async updatePassword(password: string, accessToken: string): Promise<AuthResponse> {
    try {
      const response = await this.request('/api/auth-v2/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, access_token: accessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Password update failed' };
      }

      // Save the new session if provided
      if (data.session) {
        this.saveSession(data.user, data.session);
      }

      return data;
    } catch (error) {
      console.error('Password update error:', error);
      return { error: 'Network error during password update' };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    // If we have a cached user, return it
    if (this.user) {
      return this.user;
    }

    // Otherwise fetch from server
    try {
      const response = await this.request('/api/auth-v2/me');

      if (!response.ok) {
        this.saveSession(null, null);
        return null;
      }

      const data = await response.json();
      this.user = data.user;
      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  getSession(): Session | null {
    return this.session;
  }

  isAuthenticated(): boolean {
    return !!this.session?.access_token;
  }
}

// Export singleton instance
export const auth = new AuthService();