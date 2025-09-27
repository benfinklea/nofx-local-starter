/**
 * Server middleware configuration
 */

import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import { CORS_ORIGINS } from '../../config';
import { requestObservability } from '../../lib/observability';
import { optionalAuth } from '../../auth/middleware';

export function setupBasicMiddleware(app: Express) {
  // Enable CORS for frontend development
  app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-project-id']
  }));

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(require('cookie-parser')());

  app.use(requestObservability);

  app.use(optionalAuth);
}

export function setupViewEngine(app: Express) {
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', '..', 'ui', 'views'));
  app.use('/ui/static', express.static(path.join(__dirname, '..', '..', 'ui', 'static')));
}