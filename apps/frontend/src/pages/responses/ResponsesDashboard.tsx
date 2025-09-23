import * as React from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { Link as RouterLink } from 'react-router-dom';
import { listResponsesRuns, getResponsesSummary, logUiEvent, type ResponsesRunSummary, type ResponsesOperationsSummary } from '../../lib/responses';
import StatusChip from '../../components/StatusChip';
import RateLimitPanel from '../../components/responses/RateLimitPanel';
import OpenIncidentsPanel from '../../components/responses/OpenIncidentsPanel';
import { formatNumber, formatCurrency, formatDateTime } from './formatters';

function MetricCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary">{title}</Typography>
      <Typography variant="h5">{value}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Paper>
  );
}

export default function ResponsesDashboard() {
  const [runs, setRuns] = React.useState<ResponsesRunSummary[]>([]);
  const [summary, setSummary] = React.useState<ResponsesOperationsSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [runList, ops] = await Promise.all([listResponsesRuns(), getResponsesSummary()]);
      setRuns(runList);
      setSummary(ops);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Responses runs');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    logUiEvent({ source: 'responses-dashboard', intent: 'view', metadata: { timestamp: new Date().toISOString() } });
  }, [refresh]);

  const metrics = React.useMemo(() => {
    const totals = summary;
    return [
      { title: 'Total Runs', value: formatNumber(totals?.totalRuns ?? runs.length) },
      { title: 'Failures (24h)', value: formatNumber(totals?.failuresLast24h ?? 0) },
      { title: 'Open Incidents', value: formatNumber(totals?.openIncidents ?? 0) },
      {
        title: 'Average Tokens',
        value: formatNumber(totals ? Math.round(totals.averageTokensPerRun) : 0),
        subtitle: 'per Responses run',
      },
      {
        title: 'Total Tokens',
        value: formatNumber(totals?.totalTokens ?? 0),
        subtitle: 'lifetime tokens archived',
      },
      { title: 'Total Refusals', value: formatNumber(totals?.totalRefusals ?? 0) },
      {
        title: 'Estimated Cost',
        value: formatCurrency(totals?.totalEstimatedCost ?? 0),
        subtitle: 'cached + on-demand usage',
      },
      { title: 'Last Run', value: formatDateTime(totals?.lastRunAt) },
    ];
  }, [summary, runs.length]);

  const rateLimitTenants = summary?.rateLimitTenants ?? [];
  const lastSnapshot = summary?.lastRateLimits;
  const incidents = summary?.incidentDetails ?? [];

  const refusalByRun = React.useMemo(() => {
    const map = new Map<string, number>();
    summary?.recentRuns?.forEach((run) => {
      if (typeof run.refusalCount === 'number') {
        map.set(run.runId, run.refusalCount);
      }
    });
    return map;
  }, [summary]);

  return (
    <Container sx={{ mt: 2, mb: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5">Responses Archive</Typography>
        <Chip label={`Runs: ${formatNumber(runs.length)}`} variant="outlined" color="info" />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Link component="button" onClick={refresh}>Retry</Link>}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {metrics.map((metric) => (
              <Grid key={metric.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <MetricCard title={metric.title} value={metric.value} subtitle={metric.subtitle} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <RateLimitPanel lastSnapshot={lastSnapshot} tenants={rateLimitTenants} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <OpenIncidentsPanel incidents={incidents} />
            </Grid>
          </Grid>

          <Box mt={4}>
            <Paper variant="outlined">
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Run ID</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Tenant</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell>Refusals</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {runs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No responses runs archived yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      runs.map((run) => {
                        const refusalCount = typeof run.safety?.refusalCount === 'number'
                          ? run.safety.refusalCount
                          : refusalByRun.get(run.runId);
                        const tenantName = run.metadata?.tenant_id || run.metadata?.tenantId || run.metadata?.tenant || run.tenantId || '—';
                        return (
                          <TableRow key={run.runId} hover>
                            <TableCell>
                              <Link component={RouterLink} to={`/responses/${encodeURIComponent(run.runId)}`}>
                                {run.runId}
                              </Link>
                            </TableCell>
                            <TableCell><StatusChip status={run.status} /></TableCell>
                            <TableCell>{run.model ?? '—'}</TableCell>
                            <TableCell>{tenantName || '—'}</TableCell>
                            <TableCell>{formatDateTime(run.updatedAt)}</TableCell>
                            <TableCell>{typeof refusalCount === 'number' ? refusalCount : '—'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {summary?.tenantRollup?.length ? (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>Tenant Usage</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tenant</TableCell>
                      <TableCell>Runs</TableCell>
                      <TableCell>Total Tokens</TableCell>
                      <TableCell>Avg Tokens</TableCell>
                      <TableCell>Refusals</TableCell>
                      <TableCell>Last Run</TableCell>
                      <TableCell>Estimated Cost</TableCell>
                      <TableCell>Regions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.tenantRollup.map((tenant) => (
                      <TableRow key={tenant.tenantId}>
                        <TableCell>{tenant.tenantId}</TableCell>
                        <TableCell>{formatNumber(tenant.runCount)}</TableCell>
                        <TableCell>{formatNumber(tenant.totalTokens)}</TableCell>
                        <TableCell>{formatNumber(Math.round(tenant.averageTokensPerRun))}</TableCell>
                        <TableCell>{formatNumber(tenant.refusalCount)}</TableCell>
                        <TableCell>{formatDateTime(tenant.lastRunAt)}</TableCell>
                        <TableCell>{formatCurrency(tenant.estimatedCost)}</TableCell>
                        <TableCell>
                          <Tooltip title={tenant.regions.join(', ') || '—'}>
                            <span>{tenant.regions.join(', ') || '—'}</span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </>
      )}
    </Container>
  );
}
