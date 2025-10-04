import * as React from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import SystemHealth from '../components/SystemHealth';
import RequestLogger from '../components/RequestLogger';
import HelpText from '../components/HelpText';

export default function DevTools() {
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
          <RequestLogger />
        </Grid>
      </Grid>
    </Container>
  );
}