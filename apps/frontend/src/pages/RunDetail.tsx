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
import { useParams, Link as RouterLink } from 'react-router-dom';
import { getRun, getTimeline, type Event } from '../lib/api';
import StatusChip from '../components/StatusChip';
import StepOutput from '../components/StepOutput';
import { apiBase } from '../config';

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

    // Set up Server-Sent Events for real-time updates
    const es = new EventSource(`${apiBase}/api/runs/${id}/stream`);
    es.addEventListener('init', (e: MessageEvent) => {
      try {
        setTimeline(JSON.parse((e as any).data || '[]'));
      } catch {}
    });
    es.addEventListener('append', (e: MessageEvent) => {
      try {
        const data = JSON.parse((e as any).data || '[]');
        setTimeline(prev => prev.concat(Array.isArray(data) ? data : []));
      } catch {}
    });
    es.onerror = () => { /* ignore SSE errors */ };

    return () => es.close();
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

  return (
    <Container sx={{ mt: 2 }}>
      <Box mb={2}>
        <Typography variant="h5" gutterBottom>
          {run?.run?.plan?.goal || `Run ${id}`}
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <StatusChip status={run?.run?.status || 'unknown'} />
          <Typography variant="body2" color="text.secondary">
            ID: {id}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Timeline</Typography>
            {timeline.length === 0 ? (
              <Typography color="text.secondary">No events yet</Typography>
            ) : (
              <List dense>
                {timeline.map((event, idx) => (
                  <ListItem key={idx} divider>
                    <ListItemText
                      primary={event.type}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
                          </Typography>
                          {event.payload && (
                            <Typography component="div" variant="body2" sx={{ fontSize: '0.75rem', margin: '4px 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                              {JSON.stringify(event.payload, null, 2)}
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

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Run Details</Typography>
            {run?.run && (
              <Box>
                <Typography component="div" variant="body2" gutterBottom>
                  <strong>Status:</strong> <StatusChip status={run.run.status} />
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Goal:</strong> {run.run.plan?.goal || 'N/A'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Created:</strong> {run.run.created_at ? new Date(run.run.created_at).toLocaleString() : 'N/A'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Steps:</strong> {run.run.plan?.steps?.length || 0}
                </Typography>
              </Box>
            )}
          </Paper>

          {run?.steps && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Steps</Typography>
              <List dense>
                {run.steps.map((step: any) => (
                  <ListItem key={step.id}>
                    <ListItemText
                      primary={step.name}
                      secondary={
                        <Box>
                          <StatusChip status={step.status} />
                          <Typography variant="body2" color="text.secondary">
                            Tool: {step.tool}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {run?.steps && run.steps.filter((s: any) => s.outputs || s.output || s.result).map((step: any) => (
            <Paper key={`output-${step.id}`} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Output: {step.name}</Typography>
              <StepOutput step={step} />
            </Paper>
          ))}

          {run?.artifacts && run.artifacts.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Artifacts</Typography>
              <List dense>
                {run.artifacts.map((artifact: any) => (
                  <ListItem key={artifact.id}>
                    <ListItemText
                      primary={artifact.path}
                      secondary={`${artifact.size_bytes || 0} bytes`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
