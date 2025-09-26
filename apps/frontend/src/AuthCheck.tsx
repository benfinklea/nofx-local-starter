import React, { useEffect, useState } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import LoginForm from './components/LoginForm';

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
          // Not authenticated, show login form
          setIsAuthenticated(false);
          return;
        }

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Some other error, show login form
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        // On network error, redirect to login after showing error briefly
        setError('Unable to connect to server');
        // Show login form on error
        setIsAuthenticated(false);
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

  // Show login form if not authenticated
  if (isAuthenticated === false) {
    return <LoginForm />;
  }

  // Render children only if authenticated
  return isAuthenticated ? <>{children}</> : null;
}