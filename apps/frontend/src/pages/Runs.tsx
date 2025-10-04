import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { Link as RouterLink } from 'react-router-dom';
import { listRuns, type Run } from '../lib/api';
import StatusChip from '../components/StatusChip';
import SystemHealth from '../components/SystemHealth';
import HelpText from '../components/HelpText';

export default function Runs(){
  const [rows, setRows] = React.useState<Run[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  console.log('[Runs Component] Rendering with state:', {
    rowsCount: rows.length,
    rows: rows,
    loading,
    error,
    hasRows: rows.length > 0
  });

  async function loadRuns() {
    try {
      setLoading(true);
      setError(null);
      console.log('[Runs] Loading runs...');
      const startTime = Date.now();
      const data = await listRuns(50);
      const endTime = Date.now();
      console.log('[Runs] Runs loaded successfully:', { count: data.length, loadTime: endTime - startTime + 'ms' });
      console.log('[Runs] Setting rows with data:', data);
      setRows(data);
    } catch (err) {
      console.error('[Runs] Error loading runs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load runs';
      const detailedError = `[${new Date().toISOString()}] ${errorMessage}`;
      console.error('[Runs] Detailed error info:', { error: err, timestamp: new Date().toISOString() });
      setError(detailedError);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadRuns(); }, []);

  if (loading) {
    return (
      <Container sx={{ mt: 2 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" gutterBottom>Runs ({rows.length})</Typography>
          <SystemHealth compact />
        </Box>
        <Button
          variant="contained"
          component={RouterLink}
          to="/runs/new"
        >
          New Run
        </Button>
      </Box>

      <HelpText title="About Runs" defaultOpen={rows.length === 0}>
        <strong>What are Runs?</strong> A run is a complete execution of an AI agent performing a task. Each run progresses through multiple steps, generates outputs, and passes through quality gates.
        <br /><br />
        <strong>How to use this page:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Click any run title to view detailed execution results, outputs, and artifacts</li>
          <li>Use the "New Run" button to start a new AI agent execution</li>
          <li>Monitor run status with color-coded chips (green=succeeded, red=failed, yellow=running)</li>
          <li>Check the system health indicator to ensure all services are operational</li>
        </ul>
        <strong>Pro tip:</strong> Failed runs show error details when you click them, making debugging easier.
      </HelpText>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          <Typography variant="subtitle2" gutterBottom>
            Error Loading Runs
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
            {error}
          </Typography>
          <Box>
            <Button size="small" onClick={loadRuns} sx={{ mr: 1 }}>
              Retry
            </Button>
            <Button size="small" variant="outlined" onClick={() => console.log('[Debug] Current state:', { error, loading, rowsCount: rows.length })}>
              Debug Info
            </Button>
          </Box>
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Agent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography component="div" color="text.secondary">
                    No runs found. <Link component={RouterLink} to="/runs/new">Create your first run</Link>
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/runs/${r.id}`}>
                      {(r as any).title || r.plan?.goal || 'ad-hoc run'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.secondary' }}>
                      {(r as any).agent_name || (r as any).agent_id || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell><Box component="span"><StatusChip status={r.status} /></Box></TableCell>
                  <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</TableCell>
                  <TableCell><Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{r.id}</Box></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
