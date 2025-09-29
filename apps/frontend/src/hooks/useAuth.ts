/**
 * Basic authentication hook for navigation system
 */

import { useState, useEffect } from 'react';

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate auth check
    setTimeout(() => {
      setUser({
        id: '1',
        email: 'user@example.com',
        roles: ['user'],
        permissions: ['read']
      });
      setLoading(false);
    }, 100);
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user
  };
}