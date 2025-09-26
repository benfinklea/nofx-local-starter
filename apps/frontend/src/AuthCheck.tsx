import React, { useEffect, useState } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

interface AuthCheckProps {
  children: React.ReactNode;
}

export default function AuthCheck({ children }: AuthCheckProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated by trying to fetch a protected endpoint
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/health', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else if (response.status === 401) {
          // Not authenticated, redirect to login
          window.location.href = '/login';
        } else {
          setError('Unable to verify authentication status');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setError('Unable to connect to server');
        // In case of network error, redirect to login after a delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
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