/**
 * Team route handlers - refactored using Extract Method pattern
 */

import { Request, Response } from 'express';
import { log } from '../../../lib/logger';
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

export async function handleListTeams(req: Request, res: Response) {
  try {
    const teams = await teamService.listUserTeams(req.userId!);
    res.json({ teams });
  } catch (error) {
    log.error({ error }, 'List teams error');
    res.status(500).json({ error: (error as Error).message || 'Failed to list teams' });
  }
}

export async function handleCreateTeam(req: Request, res: Response) {
  try {
    const parsed = CreateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const team = await teamService.createTeam(parsed.data, req.userId!, req.user?.email);
    res.status(201).json({ team });
  } catch (error) {
    log.error({ error }, 'Create team error');
    res.status(500).json({ error: (error as Error).message || 'Failed to create team' });
  }
}

export async function handleGetTeam(req: Request, res: Response) {
  try {
    const team = await teamService.getTeamDetails(req.params.teamId);
    res.json({ team });
  } catch (error) {
    log.error({ error }, 'Get team error');
    res.status(500).json({ error: (error as Error).message || 'Failed to get team' });
  }
}

export async function handleUpdateTeam(req: Request, res: Response) {
  try {
    const parsed = UpdateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const team = await teamService.updateTeam(req.params.teamId, parsed.data, req.userId!);
    res.json({ team });
  } catch (error) {
    log.error({ error }, 'Update team error');
    res.status(500).json({ error: (error as Error).message || 'Failed to update team' });
  }
}

export async function handleDeleteTeam(req: Request, res: Response) {
  try {
    await teamService.deleteTeam(req.params.teamId, req.userId!);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    log.error({ error }, 'Delete team error');
    res.status(500).json({ error: (error as Error).message || 'Failed to delete team' });
  }
}

export async function handleSendInvite(req: Request, res: Response) {
  try {
    const parsed = InviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
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

export async function handleAcceptInvite(req: Request, res: Response) {
  try {
    const parsed = AcceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    await inviteService.acceptInvite(parsed.data, req.user?.email || '', req.userId!);
    res.json({ message: 'Invite accepted successfully' });
  } catch (error) {
    log.error({ error }, 'Accept invite error');
    const statusCode = getErrorStatusCode((error as Error).message);
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to accept invite' });
  }
}

export async function handleCancelInvite(req: Request, res: Response) {
  try {
    await inviteService.cancelInvite(req.params.teamId, req.params.inviteId, req.userId!);
    res.json({ message: 'Invite cancelled successfully' });
  } catch (error) {
    log.error({ error }, 'Cancel invite error');
    res.status(500).json({ error: (error as Error).message || 'Failed to cancel invite' });
  }
}

export async function handleUpdateMemberRole(req: Request, res: Response) {
  try {
    const parsed = UpdateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
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

export async function handleRemoveMember(req: Request, res: Response) {
  try {
    await memberService.removeMember(req.params.teamId, req.params.memberId, req.userId!);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    log.error({ error }, 'Remove member error');
    const statusCode = (error as Error).message?.includes('Cannot') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to remove member' });
  }
}

export async function handleLeaveTeam(req: Request, res: Response) {
  try {
    await memberService.leaveTeam(req.params.teamId, req.userId!);
    res.json({ message: 'Left team successfully' });
  } catch (error) {
    log.error({ error }, 'Leave team error');
    const statusCode = (error as Error).message?.includes('cannot') ? 400 : 500;
    res.status(statusCode).json({ error: (error as Error).message || 'Failed to leave team' });
  }
}

export async function handleTransferOwnership(req: Request, res: Response) {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ error: 'New owner ID is required' });
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