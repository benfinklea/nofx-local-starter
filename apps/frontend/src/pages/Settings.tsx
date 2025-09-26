import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { apiFetch } from '../lib/api';

type SettingsDoc = {
  approvals: { dbWrites: 'none'|'dangerous'|'all'; allowWaive?: boolean };
  gates: { typecheck: boolean; lint: boolean; unit: boolean; coverageThreshold: number };
  ops?: { backupIntervalMin?: number };
  llm?: { modelOrder?: Record<string, string[]> };
};

export default function Settings(){
  const [settings, setSettings] = React.useState<SettingsDoc | null>(null);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch('/settings')
      .then(r => r.json())
      .then(d => setSettings(d.settings))
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings. Please check your connection.');
      });
  }, []);

  if (error) return <Container sx={{ mt: 2 }}><Typography color="error">{error}</Typography></Container>;
  if (!settings) return <Container sx={{ mt: 2 }}><Typography>Loading…</Typography></Container>;

  const save = async () => {
    setStatus('Saving…');
    const body = { settings };
    try {
      const rsp = await apiFetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setStatus(rsp.ok ? 'Saved' : 'Save failed');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatus('Save failed - connection error');
    }
  };

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Settings</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Approvals</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ my: 1 }}>
          <TextField label="DB Writes" size="small" value={settings.approvals.dbWrites} onChange={e=>setSettings(s=>s?{...s, approvals:{...s.approvals, dbWrites: e.target.value as any}}:s)} />
          <FormControlLabel control={<Switch checked={!!settings.approvals.allowWaive} onChange={e=>setSettings(s=>s?{...s, approvals:{...s.approvals, allowWaive: e.target.checked}}:s)} />} label="Allow Waive (dev)" />
        </Stack>
        <Typography variant="subtitle1" sx={{ mt: 2 }}>Gates</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ my: 1 }}>
          <FormControlLabel control={<Switch checked={settings.gates.typecheck} onChange={e=>setSettings(s=>s?{...s, gates:{...s.gates, typecheck: e.target.checked}}:s)} />} label="Typecheck" />
          <FormControlLabel control={<Switch checked={settings.gates.lint} onChange={e=>setSettings(s=>s?{...s, gates:{...s.gates, lint: e.target.checked}}:s)} />} label="Lint" />
          <FormControlLabel control={<Switch checked={settings.gates.unit} onChange={e=>setSettings(s=>s?{...s, gates:{...s.gates, unit: e.target.checked}}:s)} />} label="Unit" />
          <TextField label="Coverage %" type="number" size="small" value={Math.round((settings.gates.coverageThreshold||0)*100)} onChange={e=>setSettings(s=>s?{...s, gates:{...s.gates, coverageThreshold: (Number(e.target.value)||0)/100}}:s)} />
        </Stack>
        <Typography variant="subtitle1" sx={{ mt: 2 }}>Backups</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ my: 1 }}>
          <TextField label="Every (min)" type="number" size="small" value={settings.ops?.backupIntervalMin||0} onChange={e=>setSettings(s=>s?{...s, ops:{...s.ops, backupIntervalMin: Number(e.target.value)||0}}:s)} />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={save}>Save</Button>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf:'center' }}>{status}</Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

