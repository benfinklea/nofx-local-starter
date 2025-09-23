import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface ImageArtifact {
  itemId: string;
  b64JSON?: string;
  imageUrl?: string;
  background?: string | null;
  size?: string;
  createdAt?: string;
}

export interface ImageArtifactsProps {
  artifacts: ImageArtifact[];
}

export function ImageArtifacts({ artifacts }: ImageArtifactsProps) {
  if (!artifacts.length) {
    return <Typography color="text.secondary">No images generated.</Typography>;
  }
  return (
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap={2}>
      {artifacts.map((artifact) => {
        const source = artifact.imageUrl
          ? artifact.imageUrl
          : artifact.b64JSON
          ? `data:image/png;base64,${artifact.b64JSON}`
          : undefined;
        return (
          <Paper key={artifact.itemId} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>{artifact.itemId}</Typography>
            {source ? (
              <Box component="img" src={source} alt={artifact.itemId} sx={{ width: '100%', borderRadius: 1 }} />
            ) : (
              <Typography color="text.secondary" variant="body2">No image payload archived.</Typography>
            )}
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              {[artifact.size && `Size: ${artifact.size}`, artifact.background && `Background: ${artifact.background}`]
                .filter(Boolean)
                .join(' • ')}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
}

export default ImageArtifacts;
