/**
 * Simple Shell - Fallback when ManifestShell fails
 * Provides basic layout with TopBar
 */
import React from 'react';
import { Box } from '@mui/material';
import TopBar from './TopBar';

export interface SimpleShellProps {
  children: React.ReactNode;
}

export default function SimpleShell({ children }: SimpleShellProps) {
  return (
    <>
      <TopBar />
      <Box sx={{ pt: 8, p: 3 }}>
        {children}
      </Box>
    </>
  );
}