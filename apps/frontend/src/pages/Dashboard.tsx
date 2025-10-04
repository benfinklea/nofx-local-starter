import * as React from 'react';
import HelpText from '../components/HelpText';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import { Link as RouterLink } from 'react-router-dom';
import { listRuns, type Run } from '../lib/api';
import SystemHealth from '../components/SystemHealth';

function StatusChip({ status }: { status: string }) {
  const color = status === 'succeeded' ? 'success' : status === 'failed' ? 'error' : status === 'running' ? 'info' : 'default';
  return <Chip label={status} color={color as any} size="small" />;
}

export default function Dashboard(){
  const [recentRuns, setRecentRuns] = React.useState<Run[]>([]);

  React.useEffect(() => {
    console.log('Dashboard: Loading recent runs...');
    listRuns(5).then(runs => {
      console.log('Dashboard: Recent runs loaded:', runs);
      setRecentRuns(runs);
    }).catch(err => {
      console.error('Dashboard: Error loading recent runs:', err);
    });
  }, []);

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        NOFX Dashboard
      </Typography>

      <HelpText title="Welcome to NOFX" defaultOpen={recentRuns.length === 0}>
        <strong>Your AI Orchestration Hub:</strong> Monitor and control AI agents executing tasks on your codebase.
        <br /><br />
        <strong>Quick actions:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>View recent runs and their status</li>
          <li>Create new runs with the "New Run" button</li>
          <li>Monitor system health and worker status</li>
          <li>Access projects, agents, and settings</li>
        </ul>
        <strong>Getting started:</strong> Click "New Run" to create your first AI-powered task execution.
      </HelpText>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Quick Start</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" component={RouterLink} to="/runs/new">
                New Run
              </Button>
              <Button variant="outlined" component={RouterLink} to="/runs">
                Browse Runs
              </Button>
              <Button variant="outlined" component={RouterLink} to="/projects">
                Projects
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Recent Runs</Typography>
            {recentRuns.length === 0 ? (
              <Typography component="div" color="text.secondary">
                No runs yet. <Link component={RouterLink} to="/runs/new">Create your first run</Link>
              </Typography>
            ) : (
              <List>
                {recentRuns.map((run) => (
                  <ListItem key={run.id} divider>
                    <ListItemText
                      primary={
                        <Link component={RouterLink} to={`/runs/${run.id}`} sx={{ textDecoration: 'none' }}>
                          {run.plan?.goal || 'ad-hoc run'}
                        </Link>
                      }
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <StatusChip status={run.status} />
                          <Typography variant="body2" color="text.secondary">
                            {run.created_at ? new Date(run.created_at).toLocaleDateString() : ''}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <SystemHealth />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Quick Links</Typography>
            <Stack spacing={1}>
              <Button variant="outlined" size="small" href="/health" target="_blank">
                API Health
              </Button>
              <Button variant="outlined" size="small" component={RouterLink} to="/settings">
                Settings
              </Button>
              <Button variant="outlined" size="small" component={RouterLink} to="/dev">
                Dev Tools
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
