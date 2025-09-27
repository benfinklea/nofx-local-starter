import React, { useState } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  CircularProgress,
  Divider
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { auth } from '../lib/auth';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const getNextUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('next') || '/ui/app/#/runs';
  };

  const handleGoogleSignIn = () => {
    setError('');
    setMessage('');
    setSocialLoading(true);

    const next = getNextUrl();
    const url = `/api/auth/oauth-start?provider=google&next=${encodeURIComponent(next)}`;

    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSocialLoading(false);
    setError('');
    setMessage('');

    try {
      const result = await auth.login(email, password);

      if (result.error) {
        setError(result.error);
      } else {
        setMessage('Login successful! Refreshing...');
        // Refresh the page to reload the app with authentication
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await auth.resetPassword(email);

      if (result.error) {
        setError(result.error);
      } else {
        setMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          NOFX Control Plane
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mb: 3 }}
        >
          Sign in to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            margin="normal"
            autoComplete="email"
            autoFocus
            disabled={loading}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            margin="normal"
            autoComplete="current-password"
            disabled={loading}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || socialLoading}
            sx={{
              mt: 3,
              mb: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a67d8 0%, #6b4199 100%)',
              }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </form>

        <Divider sx={{ my: 2 }}>or</Divider>

        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={loading || socialLoading}
          sx={{ mb: 2, fontWeight: 600 }}
        >
          {socialLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign in with Google'}
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleForgotPassword}
            disabled={loading || socialLoading}
            sx={{ cursor: 'pointer' }}
          >
            Forgot password?
          </Link>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 3 }}
        >
          Don't have an account?{' '}
          <Link href="/signup" underline="hover">
            Create one
          </Link>
        </Typography>
      </Card>
    </Box>
  );
}
