/**
 * Team invite service - extracted invite management logic
 */

import crypto from 'crypto';
import { createServiceClient } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import { sendTeamInviteEmail } from '../../../services/email/teamEmails';
import type { InviteMemberData, AcceptInviteData } from './types';

export class InviteService {
  private async getSupabaseClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  async sendTeamInvite(
    teamId: string,
    inviteData: InviteMemberData,
    inviterUserId: string,
    inviterEmail: string
  ) {
    const supabase = await this.getSupabaseClient();

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError) {
      log.error({ error: teamError }, 'Failed to get team for invite');
      throw new Error('Team not found');
    }

    // Check if user is already a member
    await this.validateNotExistingMember(teamId, inviteData.email);

    // Check for pending invites
    await this.validateNoPendingInvite(teamId, inviteData.email);

    // Create invite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .insert({
        team_id: teamId,
        email: inviteData.email,
        role: inviteData.role,
        invited_by: inviterUserId,
        token,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        message: inviteData.message,
      })
      .select()
      .single();

    if (inviteError) {
      log.error({ error: inviteError }, 'Failed to create invite');
      throw new Error('Failed to create invite');
    }

    // Send email
    try {
      await sendTeamInviteEmail(inviteData.email, {
        teamName: team.name,
        inviterName: inviteData.inviteeName || inviterEmail,
        acceptUrl: `${process.env.FRONTEND_URL}/accept-invite?token=${token}`,
        inviteeName: inviteData.email,
        role: inviteData.role,
        message: inviteData.message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (emailError) {
      log.error({ error: emailError }, 'Failed to send invite email');
      throw new Error('Failed to send invite email');
    }

    // Log activity
    await this.logActivity(teamId, inviterUserId, 'invite.sent', 'invite', invite.id, {
      email: inviteData.email,
      role: inviteData.role,
    });

    return invite;
  }

  async acceptInvite(acceptData: AcceptInviteData, userEmail: string, userId: string) {
    const supabase = await this.getSupabaseClient();

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('token', acceptData.token)
      .single();

    if (inviteError) {
      log.error({ error: inviteError }, 'Invalid invite token');
      throw new Error('Invalid or expired invite');
    }

    // Validate invite
    this.validateInvite(invite, userEmail);

    // Add user to team
    const permissions = this.getRolePermissions(invite.role);

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invite.team_id,
        user_id: userId,
        role: invite.role,
        permissions,
      });

    if (memberError) {
      log.error({ error: memberError }, 'Failed to add member to team');
      throw new Error('Failed to join team');
    }

    // Update invite status
    const { error: updateError } = await supabase
      .from('team_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq('id', invite.id);

    if (updateError) {
      log.error({ error: updateError }, 'Failed to update invite status');
    }

    // Log activity
    await this.logActivity(invite.team_id, userId, 'invite.accepted', 'invite', invite.id, {
      email: invite.email,
    });
  }

  async cancelInvite(teamId: string, inviteId: string, userId: string) {
    const supabase = await this.getSupabaseClient();

    const { error } = await supabase
      .from('team_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('team_id', teamId);

    if (error) {
      log.error({ error }, 'Failed to cancel invite');
      throw new Error('Failed to cancel invite');
    }

    // Log activity
    await this.logActivity(teamId, userId, 'invite.cancelled', 'invite', inviteId, {});
  }

  private async validateNotExistingMember(teamId: string, email: string) {
    const supabase = await this.getSupabaseClient();

    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user.email', email); // Assuming join with users table

    if (existingMember && existingMember.length > 0) {
      throw new Error('User is already a member of this team');
    }
  }

  private async validateNoPendingInvite(teamId: string, email: string) {
    const supabase = await this.getSupabaseClient();

    const { data: existingInvites } = await supabase
      .from('team_invites')
      .select('id')
      .eq('team_id', teamId)
      .eq('email', email)
      .eq('status', 'pending');

    if (existingInvites && existingInvites.length > 0) {
      throw new Error('User already has a pending invite to this team');
    }
  }

  private validateInvite(invite: { expires_at: string; status: string; email: string }, userEmail: string) {
    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite has expired');
    }

    // Check if invite is already used
    if (invite.status !== 'pending') {
      throw new Error('Invite has already been used');
    }

    // Check if invite is for the correct user
    if (invite.email !== userEmail) {
      throw new Error('This invite is not for your email address');
    }
  }

  private async logActivity(
    teamId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>
  ) {
    const supabase = await this.getSupabaseClient();

    await supabase
      .from('team_activity_logs')
      .insert({
        team_id: teamId,
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata,
        ip_address: null,
        user_agent: null,
      });
  }

  private getRolePermissions(role: string): string[] {
    switch (role) {
      case 'owner':
        return ['read', 'write', 'delete', 'admin'];
      case 'admin':
        return ['read', 'write', 'delete'];
      case 'member':
        return ['read', 'write'];
      case 'viewer':
        return ['read'];
      default:
        return ['read'];
    }
  }
}