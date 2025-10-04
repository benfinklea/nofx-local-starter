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
import Alert from '@mui/material/Alert';
import { apiFetch } from '../lib/api';
import HelpText from '../components/HelpText';

type Model = { id?: string; provider: string; name: string; display_name?: string; kind: string; base_url?: string; active?: boolean };

export default function Models(){
  const [rows, setRows] = React.useState<Model[]>([]);
  const [adding, setAdding] = React.useState<Model>({ provider:'openai', name:'', kind:'openai' });
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function load(){
    try {
      setError(null);
      const r = await apiFetch('/api/models');
      if (!r.ok) {
        throw new Error(`Failed to load models: ${r.statusText}`);
      }
      const j = await r.json();
      setRows(j.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    }
  }
  React.useEffect(()=>{ load().catch(()=>{}); },[]);

  async function add(){
    try {
      setStatus('Saving...');
      setError(null);
      const rsp = await apiFetch('/api/models', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(adding)
      });
      if (!rsp.ok) {
        const errorData = await rsp.json().catch(() => ({ error: rsp.statusText }));
        throw new Error(errorData.error || 'Failed to save model');
      }
      setStatus('Saved');
      setAdding({ provider:'openai', name:'', kind:'openai' });
      await load();
    } catch (err) {
      setStatus('');
      setError(err instanceof Error ? err.message : 'Failed to save model');
    }
  }
  async function del(id?: string){
    if (!id) return;
    try {
      setError(null);
      const rsp = await apiFetch('/api/models/'+id, { method:'DELETE' });
      if (!rsp.ok) {
        throw new Error(`Failed to delete model: ${rsp.statusText}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  }
  async function importVendor(v: 'openai'|'anthropic'|'gemini'){
    try {
      setStatus('Importing...');
      setError(null);
      const rsp = await apiFetch('/api/models/import/'+v, { method:'POST' });
      if (!rsp.ok) {
        const errorData = await rsp.json().catch(() => ({ error: rsp.statusText }));
        throw new Error(errorData.error || `Failed to import ${v} models`);
      }
      setStatus('Imported');
      await load();
    } catch (err) {
      setStatus('');
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Models</Typography>
      <HelpText title="AI Models">
        <strong>Manage AI Models:</strong> Configure which AI models agents use for different tasks.
<br /><br />
<strong>Key concepts:</strong>
<ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
  <li>Different models have different capabilities and costs</li>
  <li>Claude models excel at code generation</li>
  <li>GPT models provide alternative options</li>
  <li>Model selection affects run cost and quality</li>
</ul>
<strong>Best practice:</strong> Use faster models for simple tasks, advanced models for complex work.
      </HelpText>

        <Stack direction="row" spacing={1}>
          <Button onClick={()=>importVendor('openai')}>Import OpenAI</Button>
          <Button onClick={()=>importVendor('anthropic')}>Import Anthropic</Button>
          <Button onClick={()=>importVendor('gemini')}>Import Gemini</Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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

