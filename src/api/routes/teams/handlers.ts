/**
 * Team route handlers - refactored using Extract Method pattern
 * Uses standardized API response utilities for type-safe responses
 */

import { Request, Response } from 'express';
import { log } from '../../../lib/logger';
import { ApiResponse } from '../../../lib/apiResponse';
import { createApiError, isError } from '../../../lib/errors';
import { TeamService } from './TeamService';
import { InviteService } from './InviteService';
import { MemberService } from './MemberService';
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  AcceptInviteSchema,
} from './types';

const teamService = new TeamService();
const inviteService = new InviteService();
const memberService = new MemberService();

/**
 * List all teams for the authenticated user
 *
 * @param req - Express request with userId set by auth middleware
 * @param res - Express response
 */
export async function handleListTeams(req: Request, res: Response): Promise<void> {
  try {
    const teams = await teamService.listUserTeams(req.userId!);
    ApiResponse.success(res, { teams });
  } catch (error) {
    log.error({ error }, 'List teams error');
    const apiError = createApiError.internal(
      'Failed to list teams',
      error,
      { userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}

/**
 * Create a new team
 *
 * @param req - Express request with validated team data
 * @param res - Express response
 */
export async function handleCreateTeam(req: Request, res: Response): Promise<void> {
  try {
    const parsed = CreateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      const apiError = createApiError.validationMultiple('Invalid request data', errors);
      ApiResponse.fromApiError(res, apiError);
      return;
    }

    const team = await teamService.createTeam(parsed.data, req.userId!, req.user?.email);
    ApiResponse.success(res, { team }, 201);
  } catch (error) {
    log.error({ error }, 'Create team error');
    const apiError = createApiError.internal(
      'Failed to create team',
      error,
      { userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}

/**
 * Get team details including members and invites
 *
 * @param req - Express request with teamId parameter
 * @param res - Express response
 */
export async function handleGetTeam(req: Request, res: Response): Promise<void> {
  try {
    const team = await teamService.getTeamDetails(req.params.teamId);
    if (!team) {
      const apiError = createApiError.notFound('Team', req.params.teamId);
      ApiResponse.fromApiError(res, apiError);
      return;
    }
    ApiResponse.success(res, { team });
  } catch (error) {
    log.error({ error }, 'Get team error');
    const apiError = createApiError.internal(
      'Failed to get team',
      error,
      { teamId: req.params.teamId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}

/**
 * Update team details
 *
 * @param req - Express request with teamId parameter and update data
 * @param res - Express response
 */
export async function handleUpdateTeam(req: Request, res: Response): Promise<void> {
  try {
    const parsed = UpdateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      const apiError = createApiError.validationMultiple('Invalid request data', errors);
      ApiResponse.fromApiError(res, apiError);
      return;
    }

    const team = await teamService.updateTeam(req.params.teamId, parsed.data, req.userId!);
    ApiResponse.success(res, { team });
  } catch (error) {
    log.error({ error }, 'Update team error');
    const apiError = createApiError.internal(
      'Failed to update team',
      error,
      { teamId: req.params.teamId, userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}

/**
 * Delete a team (owner only)
 *
 * @param req - Express request with teamId parameter
 * @param res - Express response
 */
export async function handleDeleteTeam(req: Request, res: Response): Promise<void> {
  try {
    await teamService.deleteTeam(req.params.teamId, req.userId!);
    ApiResponse.success(res, { message: 'Team deleted successfully' });
  } catch (error) {
    log.error({ error }, 'Delete team error');
    const apiError = createApiError.internal(
      'Failed to delete team',
      error,
      { teamId: req.params.teamId, userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}

export async function handleSendInvite(req: Request, res: Response): Promise<void> {
  try {
    const parsed = InviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const invite = await inviteService.sendTeamInvite(
      req.params.teamId,
      parsed.data,
      req.userId!,
      req.user?.email || ''
    );

    res.status(201).json({
      message: 'Invite sent successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
      },
    });
  } catch (error) {
    log.error({ error }, 'Send invite error');
    const statusCode = (error as Error).message?.includes('already') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to send invite' });
  }
}

export async function handleAcceptInvite(req: Request, res: Response): Promise<void> {
  try {
    const parsed = AcceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    await inviteService.acceptInvite(parsed.data, req.user?.email || '', req.userId!);
    res.json({ message: 'Invite accepted successfully' });
  } catch (error) {
    log.error({ error }, 'Accept invite error');
    const statusCode = getErrorStatusCode((error as Error).message);
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to accept invite' });
  }
}

export async function handleCancelInvite(req: Request, res: Response): Promise<void> {
  try {
    await inviteService.cancelInvite(req.params.teamId, req.params.inviteId, req.userId!);
    res.json({ message: 'Invite cancelled successfully' });
  } catch (error) {
    log.error({ error }, 'Cancel invite error');
    res.status(500).json({ error: (error as Error).message || 'Failed to cancel invite' });
  }
}

export async function handleUpdateMemberRole(req: Request, res: Response): Promise<void> {
  try {
    const parsed = UpdateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const member = await memberService.updateMemberRole(
      req.params.teamId,
      req.params.memberId,
      parsed.data,
      req.userId!
    );

    res.json({ member });
  } catch (error) {
    log.error({ error }, 'Update member role error');
    const statusCode = (error as Error).message?.includes('Cannot') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to update member role' });
  }
}

export async function handleRemoveMember(req: Request, res: Response): Promise<void> {
  try {
    await memberService.removeMember(req.params.teamId, req.params.memberId, req.userId!);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    log.error({ error }, 'Remove member error');
    const statusCode = (error as Error).message?.includes('Cannot') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to remove member' });
  }
}

export async function handleLeaveTeam(req: Request, res: Response): Promise<void> {
  try {
    await memberService.leaveTeam(req.params.teamId, req.userId!);
    res.json({ message: 'Left team successfully' });
  } catch (error) {
    log.error({ error }, 'Leave team error');
    const statusCode = (error as Error).message?.includes('cannot') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to leave team' });
  }
}

export async function handleTransferOwnership(req: Request, res: Response): Promise<void> {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      res.status(400).json({ error: 'New owner ID is required' });
      return;
    }

    await memberService.transferOwnership(req.params.teamId, newOwnerId, req.userId!);
    res.json({ message: 'Ownership transferred successfully' });
  } catch (error) {
    log.error({ error }, 'Transfer ownership error');
    const statusCode = (error as Error).message?.includes('must be') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to transfer ownership' });
  }
}

function getErrorStatusCode(errorMessage: string): number {
  if (!errorMessage) return 500;

  if (errorMessage.includes('Invalid') || errorMessage.includes('expired')) return 400;
  if (errorMessage.includes('not for your email')) return 403;
  if (errorMessage.includes('already been used')) return 400;

  return 500;
}