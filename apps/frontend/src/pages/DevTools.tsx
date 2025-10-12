import * as React from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import SystemHealth from '../components/SystemHealth';
import RequestLogger from '../components/RequestLogger';
import HelpText from '../components/HelpText';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getTraceLogStatus, setTraceLogEnabled, type TraceLogStatus } from '../lib/api';
import { useState, useEffect } from 'react';

export default function DevTools() {
  const [traceStatus, setTraceStatus] = useState<TraceLogStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTraceStatus(showSpinner = true) {
    try {
      if (showSpinner) setLoadingStatus(true);
      const status = await getTraceLogStatus();
      setTraceStatus(status);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load trace log status';
      setError(message);
    } finally {
      if (showSpinner) setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadTraceStatus();
  }, []);

  async function toggleTrace(enabled: boolean) {
    try {
      setSaving(true);
      await setTraceLogEnabled(enabled);
      await loadTraceStatus(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update trace logging';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const traceEnabled = traceStatus?.enabled ?? false;

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Developer Tools
      </Typography>
      <HelpText title="Developer Tools">
        <strong>Advanced Debugging:</strong> Developer utilities for debugging and monitoring NOFX internals.
<br /><br />
<strong>Available tools:</strong>
<ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
  <li>View raw database queries and results</li>
  <li>Inspect queue messages and processing</li>
  <li>Monitor worker threads and concurrency</li>
  <li>Debug API requests and responses</li>
</ul>
<strong>For developers only:</strong> These tools expose low-level system internals.
      </HelpText>


      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SystemHealth />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardHeader title="Run Trace Logging" subheader="Capture detailed run/step diagnostics for debugging" />
            <CardContent>
              {loadingStatus ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={20} />
                  <Typography variant="body2">Loading trace log status…</Typography>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                      {error}
                    </Alert>
                  )}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={traceEnabled}
                        onChange={(event) => toggleTrace(event.target.checked)}
                        disabled={saving}
                        color="primary"
                      />
                    }
                    label={traceEnabled ? 'Trace logging enabled' : 'Trace logging disabled'}
                  />
                  {traceStatus && (
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Source: {traceStatus.source === 'env' ? 'Environment override' : traceStatus.source === 'settings' ? 'Runtime toggle' : 'Default (off)'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Log file path: <code>{traceStatus.logFilePath}</code>
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DownloadIcon />}
                          href="/trace-log/download"
                          target="_blank"
                          rel="noopener"
                          disabled={!traceStatus.available}
                        >
                          Download Log
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={() => loadTraceStatus()}
                          disabled={saving}
                        >
                          Refresh Status
                        </Button>
                      </Stack>
                      <Stack spacing={0.5} sx={{ pl: 1 }}>
                        {traceStatus.instructions.map((line, index) => (
                          <Typography key={index} variant="body2" color="text.secondary">• {line}</Typography>
                        ))}
                        <Typography variant="body2" color="text.secondary">
                          Need help? Read{' '}
                          <Link href="https://github.com/benfinklea/nofx-local-starter/blob/main/docs/run-trace-logging.md" target="_blank" rel="noopener">
                            run-trace-logging.md
                          </Link>{' '}
                          for a full walkthrough.
                        </Typography>
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <RequestLogger />
        </Grid>
      </Grid>
    </Container>
  );
}
