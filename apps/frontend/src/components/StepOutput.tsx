import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface StepOutputProps {
  step: any;
}

export default function StepOutput({ step }: StepOutputProps) {
  // Extract output from step
  const output = step?.outputs || step?.output || step?.result;

  if (!output) return null;

  // Handle different output formats
  const renderOutput = () => {
    // If it's a string, display it directly
    if (typeof output === 'string') {
      return (
        <Typography
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}
        >
          {output}
        </Typography>
      );
    }

    // If it has a content field (common for text outputs)
    if (output.content) {
      return (
        <Typography
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}
        >
          {output.content}
        </Typography>
      );
    }

    // If it has a text field
    if (output.text) {
      return (
        <Typography
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}
        >
          {output.text}
        </Typography>
      );
    }

    // Otherwise show as formatted JSON
    return (
      <Typography
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '0.85rem'
        }}
      >
        {JSON.stringify(output, null, 2)}
      </Typography>
    );
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {step.name || 'Step Output'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ width: '100%' }}>
          {renderOutput()}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}