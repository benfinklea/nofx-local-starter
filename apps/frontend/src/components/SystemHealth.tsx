import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { apiFetch } from '../lib/api';

interface HealthStatus {
  timestamp: string;
  api: {
    status: 'ok' | 'error' | 'checking';
    latency?: number;
    error?: string;
  };
  database: {
    status: 'ok' | 'error' | 'checking';
    error?: string;
  };
  frontend: {
    status: 'ok' | 'error';
    version?: string;
  };
}

export default function SystemHealth({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = React.useState<HealthStatus>({
    timestamp: new Date().toISOString(),
    api: { status: 'checking' },
    database: { status: 'checking' },
    frontend: { status: 'ok', version: '1.0.0' }
  });
  const [lastCheck, setLastCheck] = React.useState<Date>(new Date());

  async function checkHealth() {
    const startTime = Date.now();
    console.log('[SystemHealth] Starting health check...');

    setHealth(prev => ({
      ...prev,
      timestamp: new Date().toISOString(),
      api: { status: 'checking' },
      database: { status: 'checking' }
    }));

    try {
      // Test API endpoint
      const response = await apiFetch('/health');
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.ok) {
        const healthData = await response.json();
        setHealth(prev => ({
          ...prev,
          api: { status: 'ok', latency },
          database: { status: healthData.database?.status === 'ok' ? 'ok' : 'error', error: healthData.database?.error }
        }));
        console.log('[SystemHealth] Health check passed:', { latency, healthData });
      } else {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[SystemHealth] Health check failed:', error);
      setHealth(prev => ({
        ...prev,
        api: { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
        database: { status: 'error', error: 'Cannot reach API server' }
      }));
    }

    setLastCheck(new Date());
  }

  React.useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  function getStatusChip(status: 'ok' | 'error' | 'checking', label: string) {
    const color = status === 'ok' ? 'success' : status === 'error' ? 'error' : 'default';
    const statusText = status === 'checking' ? 'Checking...' : status === 'ok' ? 'Online' : 'Offline';
    return <Chip label={`${label}: ${statusText}`} color={color as any} size="small" />;
  }

  if (compact) {
    return (
      <Box display="flex" gap={1} flexWrap="wrap">
        {getStatusChip(health.api.status, 'API')}
        {getStatusChip(health.database.status, 'DB')}
        {getStatusChip(health.frontend.status, 'UI')}
        {health.api.latency && (
          <Chip label={`${health.api.latency}ms`} size="small" variant="outlined" />
        )}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">System Health</Typography>
        <Button size="small" onClick={checkHealth} disabled={health.api.status === 'checking'}>
          Refresh
        </Button>
      </Box>

      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        {getStatusChip(health.api.status, 'API Server')}
        {getStatusChip(health.database.status, 'Database')}
        {getStatusChip(health.frontend.status, 'Frontend')}
      </Box>

      {health.api.latency && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          API Response Time: {health.api.latency}ms
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Last Check: {lastCheck.toLocaleTimeString()}
      </Typography>

      {(health.api.status === 'error' || health.database.status === 'error') && (
        <>
          <Divider sx={{ my: 2 }} />
          <Alert severity="error">
            <Typography variant="subtitle2" gutterBottom>System Issues Detected</Typography>
            {health.api.error && (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                API: {health.api.error}
              </Typography>
            )}
            {health.database.error && (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Database: {health.database.error}
              </Typography>
            )}
          </Alert>
        </>
      )}
    </Paper>
  );
}