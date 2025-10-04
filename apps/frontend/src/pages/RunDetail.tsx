import * as React from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { useParams } from 'react-router-dom';
import { getRun, getTimeline, getArtifact, type Event } from '../lib/api';
import StatusChip from '../components/StatusChip';
import RunOutputSummary from '../components/RunOutputSummary';
import Button from '@mui/material/Button';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Collapse from '@mui/material/Collapse';
import { formatCost, formatDuration } from '../lib/outputParser';

function ArtifactViewer({ artifact }: { artifact: any }) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  async function loadContent() {
    if (content) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    try {
      const data = await getArtifact(artifact.path);

      if (data) {
        setContent(data.content);
        setExpanded(true);
      } else {
        setContent('Artifact not found or could not be loaded');
        setExpanded(true);
      }
    } catch (err) {
      setContent(`Failed to load artifact: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1">
          📄 {artifact.path.split('/').pop() || artifact.path}
        </Typography>
        <Button
          size="small"
          startIcon={<VisibilityIcon />}
          onClick={loadContent}
          disabled={loading}
        >
          {loading ? 'Loading...' : expanded ? 'Hide' : 'View'}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
        {artifact.path} • {artifact.size_bytes || 0} bytes
      </Typography>
      <Collapse in={expanded}>
        {content && (
          <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'background.default', maxHeight: 400, overflow: 'auto' }}>
            <Typography
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                margin: 0,
                color: 'text.primary'
              }}
            >
              {content}
            </Typography>
          </Paper>
        )}
      </Collapse>
    </Paper>
  );
}

export default function RunDetail(){
  const { id } = useParams();
  const [run, setRun] = React.useState<any>(null);
  const [timeline, setTimeline] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [runData, timelineData] = await Promise.all([
          getRun(id!),
          getTimeline(id!)
        ]);
        setRun(runData);
        setTimeline(timelineData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run details');
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Poll for timeline updates
    const pollInterval = setInterval(async () => {
      try {
        const timelineData = await getTimeline(id!);
        setTimeline(timelineData);
      } catch (err) {
        console.debug('Timeline polling error:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [id]);

  if (loading) {
    return (
      <Container sx={{ mt: 2 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 2 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Container>
    );
  }

  // Extract cost from run metadata or plan
  const cost = run?.run?.metadata?.cost || run?.run?.plan?.cost || 0;
  const costDisplay = formatCost(cost);

  // Calculate duration
  const duration = formatDuration(
    run?.run?.started_at || run?.run?.created_at,
    run?.run?.ended_at || run?.run?.completed_at
  );

  // Generate lifecycle timeline if no events
  const effectiveTimeline = timeline.length > 0 ? timeline : generateLifecycleTimeline(run?.run);

  return (
    <Container sx={{ mt: 2, mb: 4 }}>
      {/* Header with status */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          {run?.run?.plan?.goal || `Run ${id}`}
        </Typography>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <StatusChip status={run?.run?.status || 'unknown'} />
          <Typography variant="body2" color="text.secondary">
            ID: {id}
          </Typography>
          <Tooltip title="Actual API cost (5 decimal precision)">
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {costDisplay}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            {duration}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main content - Output first */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Error Alert for Failed Runs */}
          {run?.run?.status === 'failed' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Run Failed</strong>
              </Typography>
              {run?.steps && run.steps.length > 0 && (() => {
                // Find the failed step
                const failedStep = run.steps.find((s: any) => s.status === 'failed');
                if (failedStep) {
                  // Try to extract error from outputs
                  const errorMessage = failedStep.outputs?.error ||
                                      failedStep.outputs?.message ||
                                      JSON.stringify(failedStep.outputs, null, 2);
                  return (
                    <Box>
                      <Typography variant="body2">
                        <strong>Step:</strong> {failedStep.name}
                      </Typography>
                      <Typography variant="body2" component="pre" sx={{
                        mt: 1,
                        p: 1,
                        bgcolor: 'error.dark',
                        borderRadius: 1,
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        overflow: 'auto',
                        maxHeight: 200
                      }}>
                        {errorMessage}
                      </Typography>
                    </Box>
                  );
                }
                return <Typography variant="body2">No error details available</Typography>;
              })()}
            </Alert>
          )}

          {/* Primary Output */}
          {run?.steps && run.steps.length > 0 && (
            <RunOutputSummary steps={run.steps} />
          )}

          {/* Timeline */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>⏱️ Activity Timeline</Typography>
            {effectiveTimeline.length === 0 ? (
              <Typography color="text.secondary">No activity recorded</Typography>
            ) : (
              <List dense>
                {effectiveTimeline.map((event, idx) => (
                  <ListItem key={idx} divider={idx < effectiveTimeline.length - 1}>
                    <ListItemText
                      primary={formatEventType(event.type)}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
                          </Typography>
                          {event.payload && shouldShowPayload(event.type) && (
                            <Typography
                              component="div"
                              variant="body2"
                              sx={{
                                fontSize: '0.8rem',
                                mt: 0.5,
                                color: 'text.secondary'
                              }}
                            >
                              {formatEventPayload(event.payload)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Quality Gates */}
          {run?.steps && run.steps.length > 0 && (() => {
            const gates = extractGatesFromSteps(run.steps);
            if (gates.length > 0) {
              return (
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom>🛡️ Quality Gates</Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    {gates.map((gate, idx) => (
                      <Box key={idx} mb={idx < gates.length - 1 ? 2 : 0}>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          {gate.passed ? (
                            <Box component="span" sx={{ color: 'success.main', fontSize: '1.2rem' }}>✓</Box>
                          ) : (
                            <Box component="span" sx={{ color: 'error.main', fontSize: '1.2rem' }}>✗</Box>
                          )}
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {gate.name}
                          </Typography>
                        </Box>
                        {!gate.passed && gate.reason && (
                          <Typography variant="body2" color="error.main" sx={{ ml: 3, mb: 1 }}>
                            {gate.reason}
                          </Typography>
                        )}
                        {gate.details && (
                          <Typography
                            variant="caption"
                            component="pre"
                            sx={{
                              ml: 3,
                              display: 'block',
                              whiteSpace: 'pre-wrap',
                              bgcolor: gate.passed ? 'success.light' : 'error.light',
                              color: gate.passed ? 'success.contrastText' : 'error.contrastText',
                              p: 1,
                              borderRadius: 1,
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              maxHeight: 200,
                              overflow: 'auto'
                            }}
                          >
                            {gate.details}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Paper>
                </Box>
              );
            }
            return null;
          })()}

          {/* Output Documents (formerly Artifacts) */}
          {run?.artifacts && run.artifacts.length > 0 && (
            <Box mb={2}>
              <Typography variant="h6" gutterBottom>📄 Output Documents</Typography>
              {run.artifacts.map((artifact: any) => (
                <ArtifactViewer key={artifact.id || artifact.path} artifact={artifact} />
              ))}
            </Box>
          )}

          {/* Additional Run Info */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Additional Details</Typography>
            {run?.run && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  <strong>Created:</strong> {run.run.created_at ? new Date(run.run.created_at).toLocaleString() : 'N/A'}
                </Typography>
                {run.run.started_at && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Started:</strong> {new Date(run.run.started_at).toLocaleString()}
                  </Typography>
                )}
                {run.run.ended_at && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Completed:</strong> {new Date(run.run.ended_at).toLocaleString()}
                  </Typography>
                )}
                <Typography variant="body2" gutterBottom>
                  <strong>Steps:</strong> {run.run.plan?.steps?.length || 0}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

/**
 * Generate lifecycle timeline from run data if no events exist
 */
function generateLifecycleTimeline(run: any): Event[] {
  if (!run) return [];

  const events: Event[] = [];

  if (run.created_at) {
    events.push({
      type: 'run.created',
      created_at: run.created_at,
      payload: null
    });
  }

  if (run.started_at) {
    events.push({
      type: 'run.started',
      created_at: run.started_at,
      payload: null
    });
  }

  if (run.ended_at || run.completed_at) {
    events.push({
      type: run.status === 'succeeded' ? 'run.succeeded' : 'run.completed',
      created_at: run.ended_at || run.completed_at,
      payload: null
    });
  }

  return events;
}

/**
 * Format event type for display
 */
function formatEventType(type: string): string {
  const formatted = type
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Add emoji for common events
  if (type.includes('created')) return '✨ ' + formatted;
  if (type.includes('started')) return '🚀 ' + formatted;
  if (type.includes('succeeded') || type.includes('completed')) return '✅ ' + formatted;
  if (type.includes('failed')) return '❌ ' + formatted;
  if (type.includes('enqueued')) return '📥 ' + formatted;

  return formatted;
}

/**
 * Check if payload should be shown for this event type
 */
function shouldShowPayload(type: string): boolean {
  // Don't show payload for lifecycle events
  const lifecycleEvents = ['run.created', 'run.started', 'run.succeeded', 'run.completed', 'run.failed'];
  return !lifecycleEvents.includes(type);
}

/**
 * Format event payload for display
 */
function formatEventPayload(payload: any): string {
  if (!payload || typeof payload !== 'object') return '';

  // Extract useful info
  const parts: string[] = [];

  if (payload.name) parts.push(payload.name);
  if (payload.tool) parts.push(`Tool: ${payload.tool}`);
  if (payload.message) parts.push(payload.message);

  return parts.join(' • ');
}

/**
 * Extract gate results from steps
 */
interface GateResult {
  name: string;
  passed: boolean;
  reason?: string;
  details?: string;
}

function extractGatesFromSteps(steps: any[]): GateResult[] {
  const gates: GateResult[] = [];

  for (const step of steps) {
    // Check if this step is a gate (has gate in the name or outputs)
    const isGate = step.name?.includes('gate') ||
                   step.tool?.includes('gate') ||
                   step.outputs?.gate;

    if (!isGate) continue;

    const gateName = step.outputs?.gate || step.name || 'Unknown Gate';
    const summary = step.outputs?.summary || {};
    const passed = summary.passed === true;

    // Extract failure reason and details
    let reason: string | undefined;
    let details: string | undefined;

    if (!passed) {
      // Try to get reason from various places
      reason = summary.reason ||
               summary.message ||
               step.outputs?.error ||
               'Gate check failed';

      // Try to get detailed error info
      if (summary.errors && Array.isArray(summary.errors)) {
        details = summary.errors.map((err: any) => {
          if (typeof err === 'string') return err;
          if (err.message) return `${err.file || 'File'}: ${err.message}`;
          return JSON.stringify(err);
        }).join('\n');
      } else if (summary.output) {
        details = summary.output;
      } else if (step.outputs?.stdout) {
        details = step.outputs.stdout;
      }
    }

    gates.push({
      name: formatGateName(gateName),
      passed,
      reason,
      details
    });
  }

  return gates;
}

/**
 * Format gate name for display
 */
function formatGateName(name: string): string {
  // Convert "typecheck" -> "TypeCheck"
  // Convert "security-scan" -> "Security Scan"
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
