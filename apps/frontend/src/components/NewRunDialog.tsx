import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { safeLocalStorage } from '../lib/safeLocalStorage';

export default function NewRunDialog({ open, onClose }: { open: boolean; onClose: ()=>void }){
  const [prompt, setPrompt] = React.useState('');
  const [quality, setQuality] = React.useState(true);
  const [openPr, setOpenPr] = React.useState(false);
  const [filePath, setFilePath] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState<{open:boolean; msg:string; severity:'success'|'error'}>({open:false,msg:'',severity:'success'});
  const nav = useNavigate();

  async function submit(){
    setBusy(true);
    try {
      const projectId = safeLocalStorage.getItem('projectId') || 'default';
      const body = {
        standard: { prompt, quality, openPr, filePath: filePath || undefined },
        projectId
      };
      const rsp = await apiFetch('/runs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!rsp.ok) throw new Error('Failed');
      const j = await rsp.json();
      setSnack({ open:true, msg:'Run started', severity:'success' });
      onClose();
      nav(`/runs/${j.id}`);
    } catch (e:any) {
      setSnack({ open:true, msg: e?.message || 'Failed to start run', severity:'error' });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>New Run</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} minRows={3} multiline fullWidth autoFocus/>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={quality} onChange={e=>setQuality(e.target.checked)} />} label="Quality mode (more steps)" />
              <FormControlLabel control={<Checkbox checked={openPr} onChange={e=>setOpenPr(e.target.checked)} />} label="Open PR when done" />
            </FormGroup>
            <TextField label="Target file (optional)" value={filePath} onChange={e=>setFilePath(e.target.value)} placeholder="e.g., README.md"/>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={busy || !prompt.trim()}>Start</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snack.open} autoHideDuration={2500} onClose={()=>setSnack(s=>({ ...s, open:false }))}>
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </>
  );
}

