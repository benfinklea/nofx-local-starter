import * as React from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useNavigate } from 'react-router-dom';
import { createRun, type Plan } from '../lib/api';

export default function NewRun() {
  const navigate = useNavigate();
  const [goal, setGoal] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const plan: Plan = {
        goal: goal.trim(),
        steps: [
          {
            name: 'codegen',
            tool: 'codegen',
            inputs: { task: goal.trim() }
          }
        ]
      };

      const result = await createRun(plan);
      if (result) {
        navigate(`/runs/${result.id}`);
      } else {
        setError('Failed to create run');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Create New Run
      </Typography>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Goal"
            placeholder="Describe what you want to accomplish..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 2 }}
            required
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !goal.trim()}
            >
              {loading ? 'Creating...' : 'Create Run'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/runs')}
            >
              Cancel
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
}