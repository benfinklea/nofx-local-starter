import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';

export default function DevLinks(){
  return (
    <Container sx={{ mt: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Developer Links</Typography>
        <Stack direction="row" spacing={2}>
          <Link href="/ui/dev">Dev Settings</Link>
          <Link target="_blank" rel="noreferrer" href="http://localhost:9090">Prometheus</Link>
          <Link target="_blank" rel="noreferrer" href="http://localhost:3001">Grafana</Link>
          <Link target="_blank" rel="noreferrer" href="/metrics">/metrics</Link>
        </Stack>
      </Paper>
    </Container>
  );
}

