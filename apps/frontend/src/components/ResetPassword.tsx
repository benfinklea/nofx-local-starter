import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link
} from '@mui/material';
import { auth } from '../lib/auth';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [requestingNew, setRequestingNew] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    // Check for error or token in URL
    const fullUrl = window.location.href;

    // Extract query parameters from the URL
    // The URL might be: /#/reset-password?access_token=...
    let params: URLSearchParams;

    if (fullUrl.includes('?')) {
      const queryString = fullUrl.substring(fullUrl.indexOf('?') + 1);
      params = new URLSearchParams(queryString);
    } else {
      params = new URLSearchParams('');
    }

    // Check params without logging sensitive data

    if (params.get('error')) {
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');

      if (errorCode === 'otp_expired') {
        setError('This password reset link has expired. Please request a new one below.');
        setIsExpired(true);
      } else {
        setError(errorDesc || 'An error occurred with the reset link.');
      }
    }

    // Check if we have an access token
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      // Access token found in URL
      // Store both tokens for later use
      sessionStorage.setItem('reset_access_token', accessToken);
      if (refreshToken) {
        sessionStorage.setItem('reset_refresh_token', refreshToken);
      }
    }
  }, []);

  const requestNewResetLink = async () => {
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }

    setRequestingNew(true);
    setError('');

    try {
      const result = await auth.resetPassword(resetEmail);

      if (result.error) {
        setError(result.error);
      } else {
        setResetEmailSent(true);
        setError('');
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setRequestingNew(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get the access token from sessionStorage (stored when page loaded)
      let accessToken = sessionStorage.getItem('reset_access_token');

      if (!accessToken) {
        // Try to get it from URL one more time
        const hash = window.location.hash;

        // Parse various possible formats
        if (hash.includes('access_token=')) {
          const match = hash.match(/access_token=([^&#]+)/);
          accessToken = match ? match[1] : null;
        }

        if (!accessToken) {
          throw new Error('No access token found. The reset link may be invalid or expired. Please request a new password reset.');
        }
        sessionStorage.setItem('reset_access_token', accessToken);
      }

      // Using access token for password update
      const result = await auth.updatePassword(password, accessToken);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        // Redirect to main app after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: 2
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%', padding: 4 }}>
          <Alert severity="success">
            Password updated successfully! Redirecting to login...
          </Alert>
        </Card>
      </Box>
    );
  }

  // Show request new link form if expired
  if (isExpired || resetEmailSent) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: 2
        }}
      >
        <Card
          sx={{
            maxWidth: 400,
            width: '100%',
            padding: 4,
            boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            align="center"
            sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}
          >
            Reset Password
          </Typography>

          {resetEmailSent ? (
            <>
              <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
                Password reset email sent! Check your inbox for the reset link.
              </Alert>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => window.location.href = '/'}
              >
                Return to Login
              </Button>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mt: 2, mb: 3 }}>
                Your password reset link has expired. Please request a new one.
              </Alert>

              <TextField
                label="Email Address"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                fullWidth
                required
                margin="normal"
                autoComplete="email"
                autoFocus
                disabled={requestingNew}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={requestNewResetLink}
                disabled={requestingNew}
                sx={{
                  mt: 2,
                  mb: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a67d8 0%, #6b4199 100%)',
                  }
                }}
              >
                {requestingNew ? <CircularProgress size={24} color="inherit" /> : 'Send New Reset Link'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => window.location.href = '/'}
                >
                  Return to Login
                </Link>
              </Box>
            </>
          )}
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          padding: 4,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}
        >
          Reset Password
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mb: 3 }}
        >
          Enter your new password below
        </Typography>

        {error && !isExpired && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            autoFocus
            disabled={loading}
            helperText="At least 8 characters"
          />

          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            disabled={loading}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              mt: 3,
              mb: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a67d8 0%, #6b4199 100%)',
              }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Update Password'}
          </Button>
        </form>
      </Card>
    </Box>
  );
}