import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import DescriptionIcon from '@mui/icons-material/Description';
import CodeIcon from '@mui/icons-material/Code';
import { parseStepOutput, type ParsedOutput } from '../lib/outputParser';

interface RunOutputSummaryProps {
  steps: any[];
}

export default function RunOutputSummary({ steps }: RunOutputSummaryProps) {
  // Find the primary output (usually the last successful step)
  const outputStep = steps
    .filter((s: any) => s.status?.toLowerCase() === 'succeeded')
    .find((s: any) => s.outputs || s.output || s.result);

  if (!outputStep) {
    return null;
  }

  const rawOutput = outputStep.outputs || outputStep.output || outputStep.result;
  const parsed: ParsedOutput = parseStepOutput(rawOutput);

  // Get icon based on type
  const getIcon = () => {
    switch (parsed.type) {
      case 'code_changes':
        return <CodeIcon />;
      case 'text':
      case 'structured':
        return <DescriptionIcon />;
      default:
        return <DescriptionIcon />;
    }
  };

  // Get title based on type
  const getTitle = () => {
    switch (parsed.type) {
      case 'code_changes':
        return 'Code Changes';
      case 'text':
        return 'Output';
      case 'structured':
        return 'Results';
      default:
        return 'Output';
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        {getIcon()}
        <Typography variant="h6">{getTitle()}</Typography>
        <Chip
          label={parsed.type.replace('_', ' ')}
          size="small"
          variant="outlined"
          sx={{ ml: 1 }}
        />
      </Box>

      <Typography
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          fontFamily: parsed.type === 'text' ? 'inherit' : 'monospace',
          fontSize: parsed.type === 'text' ? '1rem' : '0.9rem',
          lineHeight: 1.6,
          margin: 0,
          color: 'text.primary',
        }}
      >
        {parsed.summary}
      </Typography>

      {/* Show additional details for code changes */}
      {parsed.type === 'code_changes' && parsed.details && (
        <Box mt={2} pt={2} borderTop={1} borderColor="divider">
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Change Summary
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            {parsed.details.filesModified && parsed.details.filesModified.length > 0 && (
              <Chip
                label={`${parsed.details.filesModified.length} file${parsed.details.filesModified.length > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
              />
            )}
            {parsed.details.linesAdded! > 0 && (
              <Chip
                label={`+${parsed.details.linesAdded} lines`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {parsed.details.linesDeleted! > 0 && (
              <Chip
                label={`-${parsed.details.linesDeleted} lines`}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
