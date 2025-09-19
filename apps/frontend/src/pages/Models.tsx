import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';

type Model = { id?: string; provider: string; name: string; display_name?: string; kind: string; base_url?: string; active?: boolean };

export default function Models(){
  const [rows, setRows] = React.useState<Model[]>([]);
  const [adding, setAdding] = React.useState<Model>({ provider:'openai', name:'', kind:'openai' });
  const [status, setStatus] = React.useState('');

  async function load(){
    const r = await fetch('/models');
    if (!r.ok) return;
    const j = await r.json();
    setRows(j.models || []);
  }
  React.useEffect(()=>{ load().catch(()=>{}); },[]);

  async function add(){
    setStatus('Saving...');
    const rsp = await fetch('/models', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(adding) });
    setStatus(rsp.ok ? 'Saved' : 'Error');
    if (rsp.ok) { setAdding({ provider:'openai', name:'', kind:'openai' }); load(); }
  }
  async function del(id?: string){ if (!id) return; await fetch('/models/'+id, { method:'DELETE' }); load(); }
  async function importVendor(v: 'openai'|'anthropic'|'gemini'){
    setStatus('Importing...');
    const rsp = await fetch('/models/import/'+v, { method:'POST' });
    setStatus(rsp.ok ? 'Imported' : 'Import error');
    if (rsp.ok) load();
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Models</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={()=>importVendor('openai')}>Import OpenAI</Button>
          <Button onClick={()=>importVendor('anthropic')}>Import Anthropic</Button>
          <Button onClick={()=>importVendor('gemini')}>Import Gemini</Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Add / Update</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
          <TextField label="Provider" value={adding.provider} onChange={e=>setAdding(a=>({...a, provider:e.target.value}))} size="small"/>
          <TextField label="Name" value={adding.name} onChange={e=>setAdding(a=>({...a, name:e.target.value}))} size="small"/>
          <TextField label="Display" value={adding.display_name||''} onChange={e=>setAdding(a=>({...a, display_name:e.target.value}))} size="small"/>
          <TextField label="Kind" value={adding.kind} onChange={e=>setAdding(a=>({...a, kind:e.target.value}))} size="small"/>
          <TextField label="Base URL" value={adding.base_url||''} onChange={e=>setAdding(a=>({...a, base_url:e.target.value}))} size="small"/>
          <Button variant="contained" onClick={add}>Save</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{status}</Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Provider</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Display</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Base URL</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(m => (
              <TableRow key={m.id||m.name} hover>
                <TableCell>{m.provider}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.display_name||''}</TableCell>
                <TableCell>{m.kind}</TableCell>
                <TableCell>{m.base_url||''}</TableCell>
                <TableCell>{m.active !== false ? 'yes' : 'no'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={()=>del(m.id)}><DeleteIcon fontSize="small"/></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

