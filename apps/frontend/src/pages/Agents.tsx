import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Container,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { apiFetch } from '../lib/api';

interface AgentCapability {
  id: string;
  label: string;
  description?: string;
}

interface Agent {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  status: string;
  currentVersion: string;
  capabilities: AgentCapability[];
  tags: string[];
  updatedAt: string;
}

export default function Agents() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [agentToDelete, setAgentToDelete] = React.useState<Agent | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const fetchAgents = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch('/api/agents');
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setUploadSuccess(null);

      const content = await file.text();
      const agentData = JSON.parse(content);

      const response = await apiFetch('/api/agents/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish agent');
      }

      const result = await response.json();
      setUploadSuccess(`Agent "${result.agent.name}" published successfully!`);

      // Refresh the agent list
      await fetchAgents();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please check the file format.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to upload agent');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleFileUpload(file);
    } else {
      setError('Please drop a valid JSON file');
    }
  };

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;

    try {
      const response = await apiFetch(`/api/agents/${agentToDelete.agentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      setDeleteDialogOpen(false);
      setAgentToDelete(null);
      await fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Agent Registry
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Upload and manage AI agents for orchestration
        </Typography>
      </Box>

      {/* Upload Section */}
      <Paper
        sx={{
          p: 4,
          mb: 4,
          border: isDragging ? '2px dashed #1976d2' : '2px dashed #ccc',
          backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          accept=".json"
          style={{ display: 'none' }}
          id="agent-file-upload"
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor="agent-file-upload">
          <Box sx={{ cursor: 'pointer' }}>
            <CloudUploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {uploading ? 'Uploading...' : 'Drop agent.json file here or click to browse'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload a JSON file containing your agent definition
            </Typography>
            {uploading && <CircularProgress sx={{ mt: 2 }} />}
          </Box>
        </label>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {uploadSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUploadSuccess(null)}>
          {uploadSuccess}
        </Alert>
      )}

      {/* Agent List */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Registered Agents ({agents.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : agents.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No agents registered yet. Upload an agent.json file to get started.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {agents.map((agent) => (
            <Grid item xs={12} md={6} key={agent.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {agent.name}
                    </Typography>
                    <Chip
                      label={agent.status}
                      size="small"
                      color={agent.status === 'active' ? 'success' : 'default'}
                    />
                  </Box>

                  {agent.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {agent.description}
                    </Typography>
                  )}

                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                    ID: {agent.agentId} • Version: {agent.currentVersion}
                  </Typography>

                  {agent.capabilities.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Capabilities:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {agent.capabilities.map((cap) => (
                          <Chip
                            key={cap.id}
                            label={cap.label}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {agent.tags.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {agent.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteClick(agent)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Agent?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the agent "{agentToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
