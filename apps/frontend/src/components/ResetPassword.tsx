import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check for error or token in URL hash
    const hash = window.location.hash;
    console.log('[ResetPassword] Full hash:', hash);

    // Supabase may include the route first, then parameters
    // Format: #/reset-password#access_token=... or #access_token=...
    let paramString = hash;
    if (hash.includes('#access_token=') || hash.includes('&access_token=')) {
      // Extract the parameters part
      const tokenIndex = hash.indexOf('access_token=');
      if (tokenIndex > 0) {
        paramString = hash.substring(tokenIndex - 1); // Include the # or &
      }
    } else if (hash.includes('?')) {
      // Sometimes it's with query params
      paramString = hash.substring(hash.indexOf('?'));
    }

    console.log('[ResetPassword] Param string:', paramString);

    const params = new URLSearchParams(paramString.replace('#', '').replace(/^\/reset-password[#?]?/, ''));

    // Log all params for debugging
    console.log('[ResetPassword] Params found:');
    params.forEach((value, key) => {
      console.log(`  ${key}: ${value.substring(0, 20)}...`);
    });

    if (params.get('error')) {
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');

      if (errorCode === 'otp_expired') {
        setError('This password reset link has expired. Please request a new one.');
      } else {
        setError(errorDesc || 'An error occurred with the reset link.');
      }
    }

    // Check if we have an access token
    const accessToken = params.get('access_token');
    if (accessToken) {
      console.log('[ResetPassword] Access token found in URL');
      // Store it for later use
      sessionStorage.setItem('reset_access_token', accessToken);
    }
  }, []);

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
        console.log('[ResetPassword Submit] Checking hash again:', hash);

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

      console.log('[ResetPassword Submit] Using access token:', accessToken.substring(0, 20) + '...');

      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          newPassword: password,
          accessToken: accessToken
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        setError(data.error || 'Failed to update password');
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

        {error && (
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
            disabled={loading || !!error.includes('expired')}
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

        {error.includes('expired') && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              variant="text"
              onClick={() => window.location.href = '/'}
            >
              Return to Login
            </Button>
          </Box>
        )}
      </Card>
    </Box>
  );
}