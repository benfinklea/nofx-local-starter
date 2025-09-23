import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Box, Grid,
  Select, MenuItem, FormControl, InputLabel, Chip, Stack,
  IconButton, Alert, Card, CardContent, CardActions,
  Checkbox, FormControlLabel, FormGroup, Divider, Tabs, Tab
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';

interface BuilderTemplate {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: string;
  input: InputItem[];
  channels: {
    slack?: boolean;
    email?: boolean;
    inApp?: boolean;
  };
  metadata?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

interface InputItem {
  id: string;
  type: 'input_text' | 'input_image' | 'input_file' | 'input_audio';
  text?: string;
  image_url?: string;
  file_id?: string;
  audio?: string;
  format?: string;
}

export default function Builder() {
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [inputs, setInputs] = useState<InputItem[]>([
    { id: '1', type: 'input_text', text: '' }
  ]);
  const [channels, setChannels] = useState({
    slack: false,
    email: false,
    inApp: true
  });

  // Test run state
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<any>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/builder/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError('Failed to load templates');
    }
  };

  const handleAddInput = () => {
    const newId = String(Date.now());
    setInputs([...inputs, { id: newId, type: 'input_text', text: '' }]);
  };

  const handleRemoveInput = (id: string) => {
    setInputs(inputs.filter(i => i.id !== id));
  };

  const handleInputChange = (id: string, field: string, value: any) => {
    setInputs(inputs.map(input =>
      input.id === id ? { ...input, [field]: value } : input
    ));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name,
        description,
        instructions,
        model,
        input: inputs.filter(i =>
          (i.type === 'input_text' && i.text) ||
          (i.type === 'input_image' && i.image_url) ||
          (i.type === 'input_file' && i.file_id) ||
          (i.type === 'input_audio' && i.audio)
        ),
        channels
      };

      const res = await fetch('/builder/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create template');
      }

      setSuccess('Template created successfully!');
      fetchTemplates();

      // Reset form
      setName('');
      setDescription('');
      setInstructions('');
      setInputs([{ id: '1', type: 'input_text', text: '' }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestRun = async (templateId: string) => {
    setLoading(true);
    setError(null);
    setRunResult(null);

    try {
      const res = await fetch(`/builder/templates/${templateId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default',
          variables: testVariables
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to run template');
      }

      const result = await res.json();
      setRunResult(result);
      setSuccess('Template executed successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const modelOptions = [
    'gpt-4.1-mini',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'gemini-pro'
  ];

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Agent Builder
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab label="Create New" />
        <Tab label="Templates" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Create New Agent Template
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  {modelOptions.map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                multiline
                rows={4}
                required
                helperText="Provide clear instructions for the AI agent"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Input Configuration
              </Typography>
              <Stack spacing={2}>
                {inputs.map((input, idx) => (
                  <Paper key={input.id} variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Type</InputLabel>
                          <Select
                            value={input.type}
                            onChange={(e) => handleInputChange(input.id, 'type', e.target.value)}
                          >
                            <MenuItem value="input_text">Text</MenuItem>
                            <MenuItem value="input_image">Image</MenuItem>
                            <MenuItem value="input_file">File</MenuItem>
                            <MenuItem value="input_audio">Audio</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={7}>
                        {input.type === 'input_text' && (
                          <TextField
                            fullWidth
                            size="small"
                            label="Text content"
                            value={input.text || ''}
                            onChange={(e) => handleInputChange(input.id, 'text', e.target.value)}
                          />
                        )}
                        {input.type === 'input_image' && (
                          <TextField
                            fullWidth
                            size="small"
                            label="Image URL"
                            value={input.image_url || ''}
                            onChange={(e) => handleInputChange(input.id, 'image_url', e.target.value)}
                          />
                        )}
                        {input.type === 'input_file' && (
                          <TextField
                            fullWidth
                            size="small"
                            label="File ID"
                            value={input.file_id || ''}
                            onChange={(e) => handleInputChange(input.id, 'file_id', e.target.value)}
                          />
                        )}
                        {input.type === 'input_audio' && (
                          <TextField
                            fullWidth
                            size="small"
                            label="Audio data"
                            value={input.audio || ''}
                            onChange={(e) => handleInputChange(input.id, 'audio', e.target.value)}
                          />
                        )}
                      </Grid>
                      <Grid item xs={2}>
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveInput(input.id)}
                          disabled={inputs.length === 1}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddInput}
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Input
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Channels
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={channels.slack}
                      onChange={(e) => setChannels({ ...channels, slack: e.target.checked })}
                    />
                  }
                  label="Slack"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={channels.email}
                      onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                    />
                  }
                  label="Email"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={channels.inApp}
                      onChange={(e) => setChannels({ ...channels, inApp: e.target.checked })}
                    />
                  }
                  label="In-App"
                />
              </FormGroup>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={loading || !name || !instructions}
                startIcon={<SaveIcon />}
              >
                Create Template
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {tabValue === 1 && (
        <Box>
          {templates.length === 0 ? (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">
                No templates found. Create your first template!
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {templates.map(template => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {template.description || 'No description'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip label={template.model} size="small" color="primary" />
                        {template.channels?.slack && <Chip label="Slack" size="small" />}
                        {template.channels?.email && <Chip label="Email" size="small" />}
                        {template.channels?.inApp && <Chip label="In-App" size="small" />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(template.created_at || '').toLocaleDateString()}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => {
                          setSelectedTemplate(template);
                          handleTestRun(template.id);
                        }}
                      >
                        Test Run
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {runResult && (
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="h6" gutterBottom>Test Run Result</Typography>
              <pre style={{ overflow: 'auto', fontSize: '0.875rem' }}>
                {JSON.stringify(runResult, null, 2)}
              </pre>
            </Paper>
          )}
        </Box>
      )}
    </Container>
  );
}