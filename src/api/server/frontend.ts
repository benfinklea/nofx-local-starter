/**
 * Frontend serving and routing
 */

import { Express } from 'express';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';

export function setupFrontendRouting(app: Express) {
  // Frontend distribution handling
  const feDist = path.join(__dirname, '..', '..', '..', 'apps', 'frontend', 'dist');

  if (fs.existsSync(feDist)) {
    // Serve frontend static files with proper caching
    app.use('/ui/app', express.static(feDist, {
      maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));

    // SPA routing: catch-all for frontend routes
    app.get(/^\/ui\/app\/(?!.*\.(css|js|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json|map)).*$/, (_req, res) => {
      res.sendFile(path.join(feDist, 'index.html'));
    });
  } else {
    // Development fallback when frontend is not built
    app.get('/ui/app', (req, res) => {
      res.redirect('http://localhost:5173' + req.originalUrl);
    });
    app.get('/ui/app/*', (req, res) => {
      res.redirect('http://localhost:5173' + req.originalUrl);
    });
  }
}