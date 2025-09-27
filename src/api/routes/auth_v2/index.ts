/**
 * Authentication routes index - refactored entry point
 */

import { Express } from 'express';
import { requireAuth } from '../../../auth/middleware';
import {
  handleSignUp,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleResetPassword,
  handleUpdatePassword,
  handleGetProfile,
  handleCreateApiKey,
  handleListApiKeys,
  handleDeleteApiKey,
} from './handlers';

export default function mount(app: Express) {
  // Authentication routes
  app.post('/auth/signup', handleSignUp);
  app.post('/auth/login', handleLogin);
  app.post('/auth/logout', requireAuth, handleLogout);
  app.post('/auth/refresh', handleRefreshToken);

  // Password management routes
  app.post('/auth/reset-password', handleResetPassword);
  app.post('/auth/update-password', requireAuth, handleUpdatePassword);

  // User profile routes
  app.get('/auth/me', requireAuth, handleGetProfile);

  // API key management routes
  app.post('/auth/api-keys', requireAuth, handleCreateApiKey);
  app.get('/auth/api-keys', requireAuth, handleListApiKeys);
  app.delete('/auth/api-keys/:id', requireAuth, handleDeleteApiKey);
}