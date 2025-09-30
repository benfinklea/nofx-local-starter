import React, { useEffect, useState } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import LoginForm from './components/LoginForm';
import { auth } from './lib/auth';

interface AuthCheckProps {
  children: React.ReactNode;
}

export default function AuthCheck({ children }: AuthCheckProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has authentication credentials
    const checkAuth = async () => {
      // Check if user has authentication credentials
      try {
        // Use the auth service to check current user
        const user = await auth.getCurrentUser();

        if (user) {
          // User authenticated
          setIsAuthenticated(true);
        } else {
          // User not authenticated, show login form
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('[AuthCheck] Auth check failed with error:', err);
        // On network error, show login form
        setError('Unable to connect to server');
        // Show login form on error
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = auth.supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCheck] Auth state changed:', event, session?.user?.email);
      if (session?.user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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