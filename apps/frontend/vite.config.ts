import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

// https://vitejs.dev/config/
const repoRoot = path.resolve(__dirname, '..', '..');
const sharedDir = path.resolve(repoRoot, 'packages', 'shared');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-subpath-index',
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url || '';
            // Redirect legacy /ui/* dev paths to /ui/app/#/* so users don't see base-url warnings
            // Allow backend-auth routes to pass through (proxied): /ui/login, /login, /logout, /dev/login
            if (url === '/ui/login' || url === '/login' || url === '/logout' || url.startsWith('/dev/login')) {
              return next();
            }
            if (url.startsWith('/ui/') && !url.startsWith('/ui/app')) {
              const tail = url.slice('/ui'.length); // e.g., /runs
              res.statusCode = 302;
              res.setHeader('Location', `/ui/app/#${tail}`);
              res.end();
              return;
            }
            if (url.startsWith('/ui/app')) {
              try {
                const indexPath = path.resolve(__dirname, 'index.html');
                const htmlRaw = fs.readFileSync(indexPath, 'utf-8');
                const html = await server.transformIndexHtml('/ui/app/', htmlRaw);
                res.setHeader('Content-Type', 'text/html');
                res.end(html);
                return;
              } catch (e) { /* fallthrough */ }
            }
            next();
          });
        };
      }
    }
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(sharedDir, 'src')
    }
  },
  server: {
    port: 5173,
    open: '/ui/app/',
    proxy: {
      // Proxy API, auth, metrics, and UI endpoints to the backend
      '/runs': 'http://localhost:3000',
      '/projects': 'http://localhost:3000',
      '/models': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/gates': 'http://localhost:3000',
      '/builder': 'http://localhost:3000',
      '/backups': 'http://localhost:3000',
      '/dev': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/ui/login': 'http://localhost:3000',
      '/ui/static': 'http://localhost:3000',
      '/ui/builder': 'http://localhost:3000'
    },
    fs: {
      // Allow reading project root and shared types from the monorepo path
      allow: [__dirname, repoRoot, sharedDir]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  base: '/'
});
