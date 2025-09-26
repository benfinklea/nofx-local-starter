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
    const checkAuth = async () => {
      try {
        // Check the protected auth endpoint
        const response = await fetch('/api/auth/check', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            // Include auth token from localStorage if available
            'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || localStorage.getItem('token') || ''}`
          }
        });

        if (response.status === 401) {
          // Not authenticated, redirect to login
          window.location.href = '/login.html';
          return;
        }

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Some other error, redirect to login
          window.location.href = '/login.html';
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        // On network error, redirect to login after showing error briefly
        setError('Unable to connect to server');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 1500);
      }
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