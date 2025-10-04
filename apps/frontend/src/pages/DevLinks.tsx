import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import HelpText from '../components/HelpText';

export default function DevLinks(){
  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Developer Links</Typography>

      <HelpText title="Development Resources">
        <strong>Quick access to development tools:</strong> Links to monitoring, configuration, and debugging interfaces.
        <br /><br />
        <strong>Available resources:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li><strong>Dev Settings:</strong> Advanced developer configuration options</li>
          <li><strong>Agent Builder:</strong> Visual tool for creating and testing agent configurations</li>
          <li><strong>Prometheus:</strong> Metrics collection and monitoring (localhost:9090)</li>
          <li><strong>Grafana:</strong> Metrics visualization dashboards (localhost:3001)</li>
          <li><strong>/metrics:</strong> Raw Prometheus metrics endpoint for system monitoring</li>
        </ul>
        <strong>Note:</strong> External links (Prometheus, Grafana) require those services to be running locally.
      </HelpText>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Developer Links</Typography>
        <Stack direction="row" spacing={2}>
          <Link href="/ui/dev">Dev Settings</Link>
          <Link href="#/builder">Agent Builder</Link>
          <Link target="_blank" rel="noreferrer" href="http://localhost:9090">Prometheus</Link>
          <Link target="_blank" rel="noreferrer" href="http://localhost:3001">Grafana</Link>
          <Link target="_blank" rel="noreferrer" href="/metrics">/metrics</Link>
        </Stack>
      </Paper>
    </Container>
  );
}

