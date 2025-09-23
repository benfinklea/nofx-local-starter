import * as React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export interface MetadataTableProps {
  metadata: Record<string, string>;
}

export function MetadataTable({ metadata }: MetadataTableProps) {
  const entries = Object.entries(metadata ?? {});
  if (!entries.length) {
    return <Typography color="text.secondary">No metadata recorded.</Typography>;
  }

  return (
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', columnGap: 2, rowGap: 1 }}>
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <Typography component="dt" variant="body2" color="text.secondary">{key}</Typography>
          <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Typography>
        </React.Fragment>
      ))}
    </Box>
  );
}

export default MetadataTable;
