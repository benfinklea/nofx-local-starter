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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { listProjects, createProject, type Project } from '../lib/api';
import GitHubRepoSelector from '../components/GitHubRepoSelector';
import type { GitHubRepo } from '../lib/github';
import HelpText from '../components/HelpText';

export default function Projects(){
  const [rows, setRows] = React.useState<Project[]>([]);
  const [status, setStatus] = React.useState('');
  const [sel, setSel] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(0);

  async function load(){
    const r = await listProjects();
    setRows(r);
    const current = localStorage.getItem('projectId') || '';
    setSel(current);
  }
  React.useEffect(()=>{ load().catch(()=>{}); },[]);

  async function addFromGitHub(repo: GitHubRepo, branch: string) {
    setStatus('Adding GitHub project…');
    const projectName = repo.name;
    const p = await createProject({
      name: projectName,
      repo_url: repo.html_url,
      default_branch: branch,
      workspace_mode: 'clone'
    });
    setStatus(p ? 'GitHub project added!' : 'Error adding project');
    if (p) {
      setTab(0); // Switch back to projects list
      load();
    }
  }
  function select(id: string){
    localStorage.setItem('projectId', id);
    setSel(id);
    setStatus('Selected');
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Projects</Typography>

      <HelpText title="Managing Projects">
        <strong>What are Projects?</strong> Projects define which codebase AI agents work on. Each project can be a local folder or a GitHub repository.
        <br /><br />
        <strong>How to use:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Click "Use" to select a project as your active workspace</li>
          <li>Add GitHub repos via the "Add from GitHub" tab</li>
          <li>All runs will execute in the context of your selected project</li>
        </ul>
        <strong>Pro tip:</strong> The selected project determines which code the AI can access and modify during runs.
      </HelpText>

      {status && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {status}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, val) => setTab(val)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="My Projects" />
          <Tab label="Add from GitHub" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* Tab 0: Projects List */}
          {tab === 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Workspace</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell align="right">Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(p => (
                  <TableRow key={p.id} hover selected={sel===p.id}>
                    <TableCell>
                      {p.name}{' '}
                      <Typography component="span" color="text.secondary">
                        ({p.id})
                      </Typography>
                    </TableCell>
                    <TableCell>{p.local_path || p.repo_url || '—'}</TableCell>
                    <TableCell>{p.default_branch || 'main'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant={sel===p.id?'contained':'outlined'}
                        onClick={()=>select(p.id)}
                      >
                        Use
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Tab 1: Add from GitHub */}
          {tab === 1 && (
            <GitHubRepoSelector onSelect={addFromGitHub} />
          )}
        </Box>
      </Paper>
    </Container>
  );
}

