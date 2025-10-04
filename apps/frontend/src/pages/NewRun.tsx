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
import HelpText from '../components/HelpText';

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

      <HelpText title="How to Create a Run" defaultOpen>
        <strong>What is a Run?</strong> A run executes an AI agent to accomplish a task you describe in plain language.
        <br /><br />
        <strong>Instructions:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Enter a clear description of what you want the AI to accomplish</li>
          <li>Be specific: "Fix the login bug" works better than "fix things"</li>
          <li>Include context: "Add user authentication with email/password to the Express API"</li>
          <li>Click "Create Run" to start execution</li>
        </ul>
        <strong>Examples of good goals:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>"Write a React component for a searchable product list with filters"</li>
          <li>"Add TypeScript types to the user service module"</li>
          <li>"Fix the database connection pool timeout issue in production"</li>
          <li>"Create API tests for the authentication endpoints"</li>
        </ul>
        <strong>What happens next?</strong> The AI will generate code, run quality checks, and produce artifacts. You'll be redirected to the run details page to monitor progress.
      </HelpText>

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