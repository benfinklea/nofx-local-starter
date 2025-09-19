import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';

type DlqItem = any;

export default function DLQ(){
  const [items, setItems] = React.useState<DlqItem[]>([]);
  const [status, setStatus] = React.useState('');
  async function load(){
    const r = await fetch('/dev/dlq');
    if (!r.ok) { setStatus('Auth required?'); return; }
    const j = await r.json();
    setItems(j.items || []);
  }
  React.useEffect(()=>{ load().catch(()=>{}); },[]);
  async function rehydrate(){
    setStatus('Rehydrating…');
    const r = await fetch('/dev/dlq/rehydrate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ max: 50 }) });
    setStatus(r.ok ? 'Rehydrated' : 'Error');
    load();
  }
  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Dead-letter Queue</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Button variant="contained" onClick={rehydrate}>Rehydrate 50</Button>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2, display:'inline-block' }}>{status}</Typography>
      </Paper>
      <Paper variant="outlined">
        <Table size="small"><TableHead><TableRow><TableCell>Payload</TableCell></TableRow></TableHead>
          <TableBody>
            {items.map((it, idx) => (
              <TableRow key={idx}><TableCell><pre style={{margin:0}}>{JSON.stringify(it, null, 2)}</pre></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}

