import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import { listProjects, createProject, type Project } from '../lib/api';

export default function Projects(){
  const [rows, setRows] = React.useState<Project[]>([]);
  const [name, setName] = React.useState('My Project');
  const [local, setLocal] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [sel, setSel] = React.useState<string | null>(null);

  async function load(){
    const r = await listProjects();
    setRows(r);
    const current = localStorage.getItem('projectId') || 'default';
    setSel(current);
  }
  React.useEffect(()=>{ load().catch(()=>{}); },[]);

  async function addLocal(){
    setStatus('Saving…');
    const p = await createProject({ name, local_path: local, workspace_mode: 'local_path' });
    setStatus(p ? 'Saved' : 'Error');
    load();
  }
  function select(id: string){
    localStorage.setItem('projectId', id);
    setSel(id);
    setStatus('Selected');
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Projects</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Add Local Project</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
          <TextField label="Name" size="small" value={name} onChange={e=>setName(e.target.value)} />
          <TextField label="Local Path" size="small" placeholder="/path/to/repo" value={local} onChange={e=>setLocal(e.target.value)} fullWidth />
          <Button variant="contained" onClick={addLocal}>Add</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{status}</Typography>
      </Paper>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead><TableRow><TableCell>Project</TableCell><TableCell>Workspace</TableCell><TableCell>Branch</TableCell><TableCell align="right">Select</TableCell></TableRow></TableHead>
          <TableBody>
            {rows.map(p => (
              <TableRow key={p.id} hover selected={sel===p.id}>
                <TableCell>{p.name} <Typography component="span" color="text.secondary">({p.id})</Typography></TableCell>
                <TableCell>{p.local_path || p.repo_url || '—'}</TableCell>
                <TableCell>{p.default_branch || 'main'}</TableCell>
                <TableCell align="right"><Button size="small" variant={sel===p.id?'contained':'outlined'} onClick={()=>select(p.id)}>Use</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}

