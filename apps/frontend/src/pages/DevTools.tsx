import * as React from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import SystemHealth from '../components/SystemHealth';
import RequestLogger from '../components/RequestLogger';

export default function DevTools() {
  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h4" gutterBottom>
        Developer Tools
      </Typography>

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