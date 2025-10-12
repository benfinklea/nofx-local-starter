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
import HelpText from '../components/HelpText';
import Button from '@mui/material/Button';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
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
      <Tooltip title={artifact.path} placement="top">
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mb={1}
          sx={{
            wordBreak: 'break-all',
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}
        >
          {artifact.path} • {artifact.size_bytes || 0} bytes
        </Typography>
      </Tooltip>
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
  const [pollError, setPollError] = React.useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = React.useState(0);

  React.useEffect(() => {
    if (!id) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;
    let isPolling = false;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 1000; // Stop after ~50 minutes of polling
    const MAX_CONSECUTIVE_ERRORS = 5;
    const BASE_POLL_INTERVAL = 3000;

    // Cleanup function to abort any in-flight requests
    function cleanup() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      isPolling = false;
    }

    async function loadData(silent = false) {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        setPollError(null);

        // Create abort controller with timeout
        abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController?.abort(), 10000); // 10 second timeout

        try {
          const [runData, timelineData] = await Promise.all([
            getRun(id!),
            getTimeline(id!)
          ]);

          clearTimeout(timeoutId);
          setRun(runData);
          setTimeline(timelineData);
          setConsecutiveErrors(0); // Reset error count on success
          setPollError(null);

          return runData;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load run details';

        if (silent) {
          // During polling, track consecutive errors
          setConsecutiveErrors(prev => prev + 1);
          setPollError(errorMessage);
          console.warn('Polling error:', errorMessage);
        } else {
          // Initial load error
          setError(errorMessage);
        }

        return null;
      } finally {
        if (!silent) {
          setLoading(false);
        }
        abortController = null;
      }
    }

    // Initial load
    loadData().then(runData => {
      // Only start polling if initial load succeeded and run is active
      const status = runData?.run?.status;
      const isActive = status && ['running', 'pending', 'queued'].includes(status);

      if (isActive) {
        startPolling();
      }
    });

    function startPolling() {
      // Adaptive polling: slow down if errors, speed up if healthy
      function getNextPollInterval(): number {
        if (consecutiveErrors === 0) {
          return BASE_POLL_INTERVAL;
        } else if (consecutiveErrors < 3) {
          return BASE_POLL_INTERVAL * 2; // 6 seconds
        } else {
          return BASE_POLL_INTERVAL * 4; // 12 seconds
        }
      }

      async function poll() {
        // Prevent overlapping polls
        if (isPolling) {
          console.debug('Skipping poll - previous request still in flight');
          return;
        }

        // Stop after max attempts
        if (pollAttempts >= MAX_POLL_ATTEMPTS) {
          console.warn('Max poll attempts reached, stopping auto-refresh');
          cleanup();
          setPollError('Auto-refresh stopped after maximum attempts');
          return;
        }

        // Stop after too many consecutive errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn('Too many consecutive errors, stopping auto-refresh');
          cleanup();
          setPollError('Auto-refresh paused due to repeated errors. Refresh page to retry.');
          return;
        }

        // Check if browser is online
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.debug('Browser offline, skipping poll');
          setPollError('Offline - auto-refresh paused');
          return;
        }

        isPolling = true;
        pollAttempts++;

        try {
          const runData = await loadData(true);

          // Stop polling if run is complete
          const status = runData?.run?.status;
          if (status && !['running', 'pending', 'queued'].includes(status)) {
            cleanup();
            console.debug('Run completed, stopping auto-refresh');
            return;
          }

          // Adjust polling interval based on error rate
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = setInterval(poll, getNextPollInterval());
          }
        } catch (err) {
          console.error('Unexpected polling error:', err);
        } finally {
          isPolling = false;
        }
      }

      // Start polling
      pollInterval = setInterval(poll, BASE_POLL_INTERVAL);
    }

    // Cleanup on unmount
    return cleanup;
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
      {/* Polling error notification */}
      {pollError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setPollError(null)}>
          <Typography variant="body2">
            <strong>Auto-refresh issue:</strong> {pollError}
          </Typography>
        </Alert>
      )}

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

      <HelpText title="Understanding Run Results">
        <strong>What you're viewing:</strong> Complete execution details for this run, including outputs, quality gates, and artifacts.
        <br /><br />
        <strong>Page sections:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li><strong>Output:</strong> The main result or code changes produced by this run</li>
          <li><strong>Quality Gates:</strong> Automated checks (typecheck, security, tests) that validated the output</li>
          <li><strong>Activity Timeline:</strong> Step-by-step execution history with timestamps</li>
          <li><strong>Output Documents:</strong> Files and artifacts generated during execution (click "View" to expand)</li>
        </ul>
        <strong>Understanding status:</strong> Green (succeeded) means all steps passed. Red (failed) shows error details above. Cost and duration appear in the header.
      </HelpText>

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
          {/* Planned Steps */}
          {run?.run?.plan?.steps && run.run.plan.steps.length > 0 && (
            <Box mb={2}>
              <Typography variant="h6" gutterBottom>📋 Planned Steps</Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <List dense>
                  {run.run.plan.steps.map((plannedStep: any, idx: number) => {
                    // Find the actual step execution
                    const executedStep = run.steps?.find((s: any) => s.name === plannedStep.name || s.tool === plannedStep.tool);
                    const status = executedStep?.status || 'pending';

                    // Get status icon and color
                    const getStatusIcon = () => {
                      switch (status) {
                        case 'succeeded': return '✅';
                        case 'failed': return '❌';
                        case 'running': return '🔄';
                        case 'skipped': return '⏭️';
                        default: return '⏸️';
                      }
                    };

                    const getStatusColor = () => {
                      switch (status) {
                        case 'succeeded': return 'success.main';
                        case 'failed': return 'error.main';
                        case 'running': return 'info.main';
                        case 'skipped': return 'warning.main';
                        default: return 'text.secondary';
                      }
                    };

                    return (
                      <ListItem
                        key={idx}
                        sx={{
                          py: 1,
                          px: 0,
                          borderBottom: idx < run.run.plan.steps.length - 1 ? 1 : 0,
                          borderColor: 'divider'
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography
                                variant="caption"
                                sx={{
                                  minWidth: '20px',
                                  bgcolor: 'action.hover',
                                  px: 0.75,
                                  py: 0.25,
                                  borderRadius: 1,
                                  fontWeight: 600
                                }}
                              >
                                {idx + 1}
                              </Typography>
                              <Box component="span" fontSize="1rem">
                                {getStatusIcon()}
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {plannedStep.name}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 5 }}>
                              {plannedStep.tool}
                              {plannedStep.inputs?.filename && ` → ${plannedStep.inputs.filename}`}
                            </Typography>
                          }
                        />
                        <Chip
                          label={status}
                          size="small"
                          sx={{
                            height: '20px',
                            fontSize: '0.7rem',
                            color: getStatusColor(),
                            borderColor: getStatusColor()
                          }}
                          variant="outlined"
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </Box>
          )}

          {/* Quality Gates */}
          {run?.steps && run.steps.length > 0 && (() => {
            const gates = extractGatesFromSteps(run.steps);
            if (gates.length > 0) {
              return (
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom>🛡️ Quality Gates</Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    {gates.map((gate, idx) => {
                      // Determine display colors based on severity and pass/fail status
                      const getSeverityColor = () => {
                        if (gate.passed) return 'success';
                        // Failed gate - color based on severity
                        switch (gate.severity) {
                          case 'critical': return 'error';
                          case 'error': return 'error';
                          case 'warning': return 'warning';
                          case 'info': return 'info';
                          default: return 'warning';
                        }
                      };

                      const getSeverityBadge = () => {
                        switch (gate.severity) {
                          case 'critical': return '🔴';
                          case 'error': return '🟠';
                          case 'warning': return '🟡';
                          case 'info': return '🔵';
                          default: return '🟡';
                        }
                      };

                      const color = getSeverityColor();

                      return (
                        <Box key={idx} mb={idx < gates.length - 1 ? 2 : 0}>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            {gate.passed ? (
                              <Box component="span" sx={{ color: 'success.main', fontSize: '1.2rem' }}>✓</Box>
                            ) : (
                              <Box component="span" sx={{ fontSize: '1rem' }} title={`Severity: ${gate.severity}`}>
                                {getSeverityBadge()}
                              </Box>
                            )}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {gate.name}
                            </Typography>
                            {!gate.passed && gate.isWarning && (
                              <Typography
                                variant="caption"
                                sx={{
                                  bgcolor: `${color}.light`,
                                  color: `${color}.dark`,
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  fontSize: '0.7rem'
                                }}
                              >
                                {gate.severity === 'critical' ? 'BLOCKED' : 'WARNING'}
                              </Typography>
                            )}
                          </Box>
                          {!gate.passed && gate.reason && (
                            <Typography variant="body2" color={`${color}.main`} sx={{ ml: 3, mb: 1 }}>
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
                                bgcolor: gate.passed ? 'success.light' : `${color}.light`,
                                color: gate.passed ? 'success.contrastText' : `${color}.contrastText`,
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
                      );
                    })}
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
type GateSeverity = 'info' | 'warning' | 'error' | 'critical';

interface GateResult {
  name: string;
  passed: boolean;
  severity: GateSeverity;
  reason?: string;
  details?: string;
  isWarning?: boolean;
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

    // Determine pass/fail status
    // If summary.passed is explicitly set, use it; otherwise check step status
    let passed: boolean;
    if (summary.passed !== undefined) {
      passed = summary.passed === true;
    } else {
      // Fallback: check step status (succeeded/failed)
      passed = step.status === 'succeeded' || step.status === 'completed';
    }

    // Extract reason and details (for both pass and fail)
    let reason: string | undefined;
    let details: string | undefined;

    if (!passed) {
      // Failure reasons
      reason = summary.reason ||
               summary.message ||
               step.outputs?.error ||
               'Gate check failed';

      // Detailed error info
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
    } else {
      // Success details (optional)
      if (summary.output) {
        details = summary.output;
      } else if (step.outputs?.stdout) {
        details = step.outputs.stdout;
      }
    }

    // Extract severity and warning flag
    const severity: GateSeverity = summary.severity || 'warning';
    const isWarning = step.outputs?.warning === true;

    gates.push({
      name: formatGateName(gateName),
      passed,
      severity,
      reason,
      details,
      isWarning
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
