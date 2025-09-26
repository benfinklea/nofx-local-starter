import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Production Vite config - no localhost dependencies
const repoRoot = path.resolve(__dirname, '..', '..');
const sharedDir = path.resolve(repoRoot, 'packages', 'shared');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(sharedDir, 'src')
    }
  },
  server: {
    port: 5173,
    // No proxy in production - all API calls go through relative paths
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Optimize for production
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled']
        }
      }
    }
  },
  base: '/ui/app/'
});