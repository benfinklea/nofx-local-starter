/**
 * Authentication route handlers - using extracted services
 */

import { Request, Response } from 'express';
import { log } from '../../../lib/logger';
import { AuthService } from './AuthService';
import { ApiKeyService } from './ApiKeyService';
import {
  SignUpSchema,
  LoginSchema,
  ResetPasswordSchema,
  UpdatePasswordSchema,
} from './types';

const authService = new AuthService();
const apiKeyService = new ApiKeyService();

export async function handleSignUp(req: Request, res: Response) {
  try {
    const parsed = SignUpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = await authService.signUp(parsed.data, req, res);
    res.status(201).json(result);
  } catch (error) {
    log.error({ error }, 'Signup error');
    const message = (error as Error).message || 'Signup failed';
    const statusCode = message.includes('service unavailable') ? 500 : 400;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = await authService.signIn(parsed.data, req, res);
    res.json(result);
  } catch (error) {
    log.error({ error }, 'Login error');
    const message = (error as Error).message || 'Login failed';
    const statusCode = message.includes('service unavailable') ? 500 : 401;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleLogout(req: Request, res: Response) {
  try {
    await authService.signOut(req, res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    log.error({ error }, 'Logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
}

export async function handleRefreshToken(req: Request, res: Response) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await authService.refreshSession(refresh_token, req, res);
    res.json(result);
  } catch (error) {
    log.error({ error }, 'Token refresh error');
    const message = (error as Error).message || 'Token refresh failed';
    const statusCode = message.includes('service unavailable') ? 500 : 401;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleResetPassword(req: Request, res: Response) {
  try {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    await authService.resetPassword(parsed.data);
    res.json({
      success: true,
      message: 'Password reset email sent. Please check your email.'
    });
  } catch (error) {
    log.error({ error }, 'Password reset error');
    const message = (error as Error).message || 'Password reset failed';
    const statusCode = message.includes('service unavailable') ? 500 : 400;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleUpdatePassword(req: Request, res: Response) {
  try {
    const parsed = UpdatePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    await authService.updatePassword(parsed.data, req, res);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    log.error({ error }, 'Password update error');
    const message = (error as Error).message || 'Password update failed';
    const statusCode = message.includes('service unavailable') ? 500 : 400;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleGetProfile(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authService.getUserProfile(req.userId);
    res.json({ user });
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Get profile error');
    const message = (error as Error).message;
    const statusCode = message === 'User not found' ? 404 : 500;
    res.status(statusCode).json({ error: message || 'Failed to get user profile' });
  }
}

export async function handleCreateApiKey(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, permissions } = req.body;

    if (!name || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Name and permissions array are required'
      });
    }

    const apiKey = await apiKeyService.createApiKey(
      { name, permissions },
      req.userId,
      req
    );

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      apiKey
    });
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Create API key error');
    const message = (error as Error).message || 'Failed to create API key';
    const statusCode = message.includes('already exists') ? 400 : 500;
    res.status(statusCode).json({ error: message });
  }
}

export async function handleListApiKeys(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKeys = await apiKeyService.listApiKeys(req.userId);
    res.json({ apiKeys });
  } catch (error) {
    log.error({ error, userId: req.userId }, 'List API keys error');
    res.status(500).json({ error: 'Failed to retrieve API keys' });
  }
}

export async function handleDeleteApiKey(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'API key ID is required' });
    }

    await apiKeyService.deleteApiKey(id, req.userId, req);
    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Delete API key error');
    const message = (error as Error).message || 'Failed to delete API key';
    const statusCode = message === 'API key not found' ? 404 : 500;
    res.status(statusCode).json({ error: message });
  }
}