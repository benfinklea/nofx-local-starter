import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { parseStepOutput } from '../lib/outputParser';

interface StepOutputProps {
  step: any;
}

export default function StepOutput({ step }: StepOutputProps) {
  // Extract output from step
  const output = step?.outputs || step?.output || step?.result;

  if (!output) return null;

  // Parse output intelligently
  const parsed = parseStepOutput(output);

  return (
    <Accordion defaultExpanded={false}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {step.name || 'Step Output'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ width: '100%' }}>
          <Typography
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: parsed.type === 'text' ? 'inherit' : 'monospace',
              fontSize: parsed.type === 'text' ? '0.95rem' : '0.85rem',
              lineHeight: 1.6,
              margin: 0,
              color: 'text.primary'
            }}
          >
            {parsed.summary}
          </Typography>

          {/* Show raw data in collapsed section if available */}
          {parsed.raw && parsed.type !== 'unknown' && (
            <Accordion sx={{ mt: 2, bgcolor: 'grey.50' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="caption" color="text.secondary">
                  Raw Output
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    margin: 0,
                    color: 'text.secondary'
                  }}
                >
                  {JSON.stringify(parsed.raw, null, 2)}
                </Typography>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
