import React, { useEffect, useState } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

interface AuthCheckProps {
  children: React.ReactNode;
}

export default function AuthCheck({ children }: AuthCheckProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has authentication credentials
    const checkAuth = () => {
      // Check for Supabase session in localStorage
      const supabaseAuth = localStorage.getItem('supabase.auth.token');
      const sbAccessToken = localStorage.getItem('sb-access-token');
      const apiToken = localStorage.getItem('token');

      // Also check for any Supabase-specific session keys
      const hasSupabaseSession = Object.keys(localStorage).some(key =>
        key.includes('supabase.auth') || key.includes('sb-') && key.includes('auth-token')
      );

      if (!supabaseAuth && !sbAccessToken && !apiToken && !hasSupabaseSession) {
        // No authentication tokens found, redirect to login immediately
        window.location.href = '/login';
        return;
      }

      // If we have some form of auth token, verify it's still valid
      fetch('/api/health', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      }).then(response => {
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Token might be expired, redirect to login
          window.location.href = '/login';
        }
      }).catch(err => {
        console.error('Auth check failed:', err);
        setError('Unable to connect to server');
        // In case of network error, redirect to login after a delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      });
    };

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
        <Typography variant="body1" color="textSecondary" mt={2}>
          Verifying authentication...
        </Typography>
      </Box>
    );
  }

  // Show error if auth check failed
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <Typography variant="h6" color="error" gutterBottom>
          Authentication Error
        </Typography>
        <Typography variant="body1" color="textSecondary">
          {error}
        </Typography>
        <Typography variant="body2" color="textSecondary" mt={2}>
          Redirecting to login...
        </Typography>
      </Box>
    );
  }

  // Render children only if authenticated
  return isAuthenticated ? <>{children}</> : null;
}