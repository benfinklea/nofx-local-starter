/**
 * Team-related Email Services
 * Handles team invites, member notifications, and team updates
 */

import { sendEmail, isValidEmail } from '../../lib/email/resend-client';
import TeamInviteEmail from '../../features/emails/TeamInviteEmail';
import { log } from '../../lib/logger';
import { EMAIL_SETTINGS } from '../../config/email';
import { createServiceClient } from '../../auth/supabase';

/**
 * Send team invite email
 */
export async function sendTeamInviteEmail(
  email: string,
  inviteData: {
    teamName: string;
    inviterName: string;
    inviteeName: string;
    role: 'admin' | 'member' | 'viewer';
    message?: string;
    acceptUrl: string;
    expiresAt: string;
  }
): Promise<boolean> {
  try {
    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address for team invite');
      return false;
    }

    const result = await sendEmail({
      to: email,
      subject: `You're invited to join ${inviteData.teamName} on NOFX`,
      react: TeamInviteEmail(inviteData),
      tags: [
        { name: 'type', value: 'team_invite' },
        { name: 'team', value: inviteData.teamName },
        { name: 'role', value: inviteData.role },
      ],
    });

    if (result.success) {
      log.info({ email, teamName: inviteData.teamName }, 'Team invite email sent');
    } else {
      log.error({ email, error: result.error }, 'Failed to send team invite email');
    }

    return result.success;
  } catch (error) {
    log.error({ error, email }, 'Error sending team invite email');
    return false;
  }
}

/**
 * Send notification when user joins team
 */
export async function sendTeamMemberJoinedEmail(
  teamOwnerId: string,
  memberData: {
    memberName: string;
    memberEmail: string;
    teamName: string;
    role: string;
  }
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return false;

    // Get team owner's email
    const { data: owner } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', teamOwnerId)
      .single();

    if (!owner?.email) {
      log.error({ teamOwnerId }, 'Team owner email not found');
      return false;
    }

    const html = `
      <h2>New Team Member Joined</h2>
      <p><strong>${memberData.memberName}</strong> (${memberData.memberEmail}) has joined <strong>${memberData.teamName}</strong> as a ${memberData.role}.</p>
      <p><a href="${EMAIL_SETTINGS.company.website}/teams">Manage your team</a></p>
    `;

    const result = await sendEmail({
      to: owner.email,
      subject: `${memberData.memberName} joined ${memberData.teamName}`,
      html,
      tags: [
        { name: 'type', value: 'team_member_joined' },
        { name: 'team', value: memberData.teamName },
      ],
    });

    return result.success;
  } catch (error) {
    log.error({ error }, 'Error sending team member joined email');
    return false;
  }
}

/**
 * Send notification when member leaves team
 */
export async function sendTeamMemberLeftEmail(
  teamOwnerId: string,
  memberData: {
    memberName: string;
    memberEmail: string;
    teamName: string;
  }
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return false;

    // Get team owner's email
    const { data: owner } = await supabase
      .from('users')
      .select('email')
      .eq('id', teamOwnerId)
      .single();

    if (!owner?.email) {
      log.error({ teamOwnerId }, 'Team owner email not found');
      return false;
    }

    const html = `
      <h2>Team Member Left</h2>
      <p><strong>${memberData.memberName}</strong> (${memberData.memberEmail}) has left <strong>${memberData.teamName}</strong>.</p>
      <p><a href="${EMAIL_SETTINGS.company.website}/teams">Manage your team</a></p>
    `;

    const result = await sendEmail({
      to: owner.email,
      subject: `${memberData.memberName} left ${memberData.teamName}`,
      html,
      tags: [
        { name: 'type', value: 'team_member_left' },
        { name: 'team', value: memberData.teamName },
      ],
    });

    return result.success;
  } catch (error) {
    log.error({ error }, 'Error sending team member left email');
    return false;
  }
}

/**
 * Send notification when ownership is transferred
 */
export async function sendOwnershipTransferredEmail(
  newOwnerId: string,
  oldOwnerId: string,
  teamName: string
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return false;

    // Get both users' emails
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', [newOwnerId, oldOwnerId]);

    if (!users || users.length !== 2) {
      log.error({ newOwnerId, oldOwnerId }, 'Could not find user emails');
      return false;
    }

    const newOwner = users.find(u => u.id === newOwnerId);
    const oldOwner = users.find(u => u.id === oldOwnerId);

    if (!newOwner?.email || !oldOwner?.email) return false;

    // Email to new owner
    const newOwnerHtml = `
      <h2>You're now the owner of ${teamName}</h2>
      <p>${oldOwner.full_name || oldOwner.email} has transferred ownership of <strong>${teamName}</strong> to you.</p>
      <p>As the team owner, you have full control over:</p>
      <ul>
        <li>Team settings and billing</li>
        <li>Member management</li>
        <li>Resource allocation</li>
      </ul>
      <p><a href="${EMAIL_SETTINGS.company.website}/teams">Manage your team</a></p>
    `;

    await sendEmail({
      to: newOwner.email,
      subject: `You're now the owner of ${teamName}`,
      html: newOwnerHtml,
      tags: [
        { name: 'type', value: 'ownership_received' },
        { name: 'team', value: teamName },
      ],
    });

    // Email to old owner
    const oldOwnerHtml = `
      <h2>Ownership Transfer Complete</h2>
      <p>You have successfully transferred ownership of <strong>${teamName}</strong> to ${newOwner.full_name || newOwner.email}.</p>
      <p>You remain a team admin with management privileges.</p>
      <p><a href="${EMAIL_SETTINGS.company.website}/teams">View team</a></p>
    `;

    await sendEmail({
      to: oldOwner.email,
      subject: `Ownership of ${teamName} transferred`,
      html: oldOwnerHtml,
      tags: [
        { name: 'type', value: 'ownership_transferred' },
        { name: 'team', value: teamName },
      ],
    });

    return true;
  } catch (error) {
    log.error({ error }, 'Error sending ownership transfer emails');
    return false;
  }
}

/**
 * Send team deletion warning
 */
export async function sendTeamDeletionWarningEmail(
  teamId: string,
  daysUntilDeletion: number = 7
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return false;

    // Get team and members
    const { data: team } = await supabase
      .from('teams')
      .select(`
        name,
        members:team_members (
          user:users (
            email,
            full_name
          ),
          role
        )
      `)
      .eq('id', teamId)
      .single();

    if (!team?.members) return false;

    // Send to all team admins and owner
    const admins = team.members.filter(m => m.role === 'owner' || m.role === 'admin');

    for (const admin of admins) {
      const user = Array.isArray(admin.user) ? admin.user[0] : admin.user;
      if (!user?.email) continue;

      const html = `
        <h2>⚠️ Team Deletion Warning</h2>
        <p>Your team <strong>${team.name}</strong> is scheduled for deletion in ${daysUntilDeletion} days due to inactivity or billing issues.</p>
        <p>To prevent deletion:</p>
        <ul>
          <li>Update your billing information</li>
          <li>Reactivate your subscription</li>
          <li>Contact support if you believe this is an error</li>
        </ul>
        <p><a href="${EMAIL_SETTINGS.company.website}/billing">Update Billing</a></p>
        <p>All team data, workflows, and resources will be permanently deleted if no action is taken.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: `⚠️ ${team.name} will be deleted in ${daysUntilDeletion} days`,
        html,
        tags: [
          { name: 'type', value: 'team_deletion_warning' },
          { name: 'team', value: team.name },
        ],
      });
    }

    return true;
  } catch (error) {
    log.error({ error }, 'Error sending team deletion warning');
    return false;
  }
}
