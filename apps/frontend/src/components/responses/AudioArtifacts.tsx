import * as React from 'react';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface AudioSegment {
  itemId: string;
  audioBase64?: string;
  format?: string;
  transcript?: string;
}

export interface AudioArtifactsProps {
  segments: AudioSegment[];
}

export function AudioArtifacts({ segments }: AudioArtifactsProps) {
  if (!segments.length) {
    return <Typography color="text.secondary">No audio captured.</Typography>;
  }
  return (
    <Stack spacing={2}>
      {segments.map((segment) => {
        const source = segment.audioBase64
          ? `data:audio/${segment.format || 'wav'};base64,${segment.audioBase64}`
          : undefined;
        return (
          <Paper key={segment.itemId} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{segment.itemId}</Typography>
            {source ? (
              <audio controls preload="none" src={source} style={{ width: '100%' }} />
            ) : (
              <Typography color="text.secondary" variant="body2">No audio payload archived.</Typography>
            )}
            {segment.transcript && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Transcript: {segment.transcript}
              </Typography>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}

export default AudioArtifacts;
