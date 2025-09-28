/**
 * Feedback Widget for navigation improvement suggestions
 * Phase 1.5 - Track C implementation
 */

import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  QuestionMark as QuestionIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useNavigationContext } from '../hooks/useNavigation';

interface FeedbackWidgetProps {
  open: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'question' | 'performance';

const feedbackTypeConfig = {
  bug: {
    icon: BugReportIcon,
    label: 'Bug Report',
    color: 'error' as const,
  },
  feature: {
    icon: LightbulbIcon,
    label: 'Feature Request',
    color: 'success' as const,
  },
  question: {
    icon: QuestionIcon,
    label: 'Question',
    color: 'info' as const,
  },
  performance: {
    icon: SpeedIcon,
    label: 'Performance Issue',
    color: 'warning' as const,
  },
};

export default function FeedbackWidget({ open, onClose }: FeedbackWidgetProps) {
  const location = useLocation();
  const { breadcrumbs } = useNavigationContext();
  const [feedbackType, setFeedbackType] = React.useState<FeedbackType>('feature');
  const [rating, setRating] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  // Reset form on open
  React.useEffect(() => {
    if (open) {
      setFeedbackType('feature');
      setRating(null);
      setTitle('');
      setDescription('');
      setEmail('');
      setSubmitted(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title || !description) {
      setError('Please provide a title and description');
      return;
    }

    setSubmitting(true);
    setError('');

    const feedbackData = {
      type: feedbackType,
      rating,
      title,
      description,
      email,
      page: location.pathname,
      breadcrumbs: breadcrumbs.map(b => b.label).join(' > '),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    try {
      // In production, this would send to an API endpoint
      // For now, we'll log it and simulate a delay
      // console.log('[Feedback Submitted]', feedbackData);

      // If GitHub integration is available, create an issue
      if (window.location.hostname === 'localhost') {
        // Local development - just log
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Production - could integrate with GitHub API or Linear
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData),
        });

        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const TypeIcon = feedbackTypeConfig[feedbackType].icon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TypeIcon color={feedbackTypeConfig[feedbackType].color} />
            <Typography variant="h6">Send Feedback</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {submitted ? (
          <Alert severity="success" sx={{ my: 2 }}>
            Thank you for your feedback! We'll review it and take action as needed.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Feedback Type */}
            <FormControl fullWidth>
              <InputLabel>Feedback Type</InputLabel>
              <Select
                value={feedbackType}
                label="Feedback Type"
                onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              >
                {Object.entries(feedbackTypeConfig).map(([type, config]) => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <config.icon fontSize="small" color={config.color} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Navigation Rating */}
            <Box>
              <Typography component="legend" variant="body2" sx={{ mb: 1 }}>
                How would you rate the navigation experience?
              </Typography>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue)}
                size="large"
              />
            </Box>

            {/* Title */}
            <TextField
              fullWidth
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your feedback"
              required
            />

            {/* Description */}
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about your feedback..."
              required
            />

            {/* Email (optional) */}
            <TextField
              fullWidth
              type="email"
              label="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              helperText="Provide your email if you'd like us to follow up"
            />

            {/* Context */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Current page: {location.pathname}
              </Typography>
              {breadcrumbs.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {breadcrumbs.map((crumb, index) => (
                    <Chip
                      key={index}
                      label={crumb.label}
                      size="small"
                      sx={{ mr: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {error && (
              <Alert severity="error">{error}</Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || submitted}
          startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {submitting ? 'Sending...' : 'Send Feedback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}