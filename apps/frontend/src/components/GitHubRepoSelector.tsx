/**
 * GitHub Repository Selector Component
 * Allows users to connect GitHub and select repositories
 */

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import GitHubIcon from '@mui/icons-material/GitHub';
import { github, type GitHubRepo, type GitHubBranch } from '../lib/github';

interface GitHubRepoSelectorProps {
  onSelect: (repo: GitHubRepo, branch: string) => void;
  disabled?: boolean;
}

export default function GitHubRepoSelector({ onSelect, disabled }: GitHubRepoSelectorProps) {
  const [connected, setConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [repos, setRepos] = React.useState<GitHubRepo[]>([]);
  const [branches, setBranches] = React.useState<GitHubBranch[]>([]);
  const [selectedRepo, setSelectedRepo] = React.useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = React.useState<string>('');
  const [loadingBranches, setLoadingBranches] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [githubUser, setGithubUser] = React.useState<{ login?: string; avatar_url?: string } | null>(null);

  // Check GitHub connection on mount
  React.useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setLoading(true);
    const isConnected = await github.isConnected();
    setConnected(isConnected);

    if (isConnected) {
      // Fetch user info and repos
      const userResult = await github.getCurrentUser();
      if (!userResult.error) {
        setGithubUser(userResult);
      }

      const { repos: fetchedRepos, error: reposError } = await github.listRepositories();
      if (reposError) {
        setError(reposError);
      } else {
        setRepos(fetchedRepos);
      }
    }

    setLoading(false);
  }

  async function handleConnect() {
    setError(null);
    const result = await github.connectGitHub();

    if (!result.success) {
      setError(result.error || 'Failed to connect to GitHub');
    }
    // Note: User will be redirected to GitHub OAuth flow
    // On return, the page will reload and checkConnection will run again
  }

  async function handleRepoSelect(_event: any, repo: GitHubRepo | null) {
    setSelectedRepo(repo);
    setSelectedBranch('');
    setBranches([]);

    if (repo) {
      setLoadingBranches(true);
      const [owner, repoName] = repo.full_name.split('/');
      const { branches: fetchedBranches, error: branchError } = await github.listBranches(owner, repoName);

      if (branchError) {
        setError(branchError);
      } else {
        setBranches(fetchedBranches);
        // Auto-select default branch
        if (repo.default_branch) {
          setSelectedBranch(repo.default_branch);
        }
      }
      setLoadingBranches(false);
    }
  }

  function handleAddProject() {
    if (selectedRepo && selectedBranch) {
      onSelect(selectedRepo, selectedBranch);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 2 }}>Checking GitHub connection...</Typography>
      </Box>
    );
  }

  if (!connected) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">
          Connect your GitHub account to browse and select repositories
        </Alert>
        <Button
          variant="contained"
          startIcon={<GitHubIcon />}
          onClick={handleConnect}
          disabled={disabled}
        >
          Connect GitHub
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {githubUser && (
        <Box display="flex" alignItems="center" gap={1}>
          {githubUser.avatar_url && (
            <Avatar src={githubUser.avatar_url} sx={{ width: 24, height: 24 }} />
          )}
          <Typography variant="body2" color="text.secondary">
            Connected as <strong>@{githubUser.login}</strong>
          </Typography>
          <Chip label="GitHub" size="small" color="success" />
        </Box>
      )}

      <Autocomplete
        options={repos}
        getOptionLabel={(repo) => repo.full_name}
        value={selectedRepo}
        onChange={handleRepoSelect}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select Repository"
            placeholder="Search repositories..."
            size="small"
          />
        )}
        renderOption={(props, repo) => (
          <li {...props} key={repo.id}>
            <Box>
              <Typography variant="body2">{repo.full_name}</Typography>
              {repo.description && (
                <Typography variant="caption" color="text.secondary">
                  {repo.description}
                </Typography>
              )}
            </Box>
          </li>
        )}
      />

      {selectedRepo && (
        <Autocomplete
          options={branches.map(b => b.name)}
          value={selectedBranch}
          onChange={(_event, branch) => setSelectedBranch(branch || '')}
          disabled={disabled || loadingBranches}
          loading={loadingBranches}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Branch"
              placeholder="Choose a branch..."
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingBranches && <CircularProgress size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Button
        variant="contained"
        onClick={handleAddProject}
        disabled={!selectedRepo || !selectedBranch || disabled}
        fullWidth
      >
        Add Project from GitHub
      </Button>
    </Stack>
  );
}
