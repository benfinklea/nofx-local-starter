/**
 * Team Management Routes for NOFX SaaS
 * Handles team creation, invites, and member management
 */

import { Express, Request, Response } from 'express';
import { createServiceClient } from '../../auth/supabase';
import { requireAuth, requireTeamAccess } from '../../auth/middleware';
import { log } from '../../lib/logger';
import { z } from 'zod';
import { sendTeamInviteEmail } from '../../services/email/teamEmails';
import crypto from 'crypto';

// Validation schemas
const CreateTeamSchema = z.object({
  name: z.string().min(2).max(255),
  billingEmail: z.string().email().optional(),
});

const UpdateTeamSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  billingEmail: z.string().email().optional(),
  settings: z.record(z.any()).optional(),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  inviteeName: z.string().optional(),
  message: z.string().optional(),
});

const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

const AcceptInviteSchema = z.object({
  token: z.string(),
});

export default function mount(app: Express) {
  /**
   * List user's teams
   */
  app.get('/teams', requireAuth, async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Get teams where user is a member
      const { data: teams, error } = await supabase
        .from('team_members')
        .select(`
          team:teams (
            id,
            name,
            slug,
            owner_id,
            subscription_status,
            trial_ends_at,
            created_at
          ),
          role,
          joined_at
        `)
        .eq('user_id', req.userId)
        .order('joined_at', { ascending: false });

      if (error) {
        log.error({ error }, 'Failed to list teams');
        return res.status(500).json({ error: 'Failed to list teams' });
      }

      res.json({ teams: teams || [] });
    } catch (error) {
      log.error({ error }, 'List teams error');
      res.status(500).json({ error: 'Failed to list teams' });
    }
  });

  /**
   * Create a new team
   */
  app.post('/teams', requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = CreateTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { name, billingEmail } = parsed.data;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name,
          slug,
          owner_id: req.userId,
          billing_email: billingEmail || req.user?.email,
        })
        .select()
        .single();

      if (teamError) {
        log.error({ error: teamError }, 'Failed to create team');
        return res.status(500).json({ error: 'Failed to create team' });
      }

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: req.userId,
          role: 'owner',
          permissions: ['read', 'write', 'delete', 'admin'],
        });

      if (memberError) {
        log.error({ error: memberError }, 'Failed to add team owner');
        // Clean up team
        await supabase.from('teams').delete().eq('id', team.id);
        return res.status(500).json({ error: 'Failed to create team' });
      }

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: team.id,
          user_id: req.userId,
          action: 'team.created',
          resource_type: 'team',
          resource_id: team.id,
          metadata: { name },
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.status(201).json({ team });
    } catch (error) {
      log.error({ error }, 'Create team error');
      res.status(500).json({ error: 'Failed to create team' });
    }
  });

  /**
   * Get team details
   */
  app.get('/teams/:teamId', requireAuth, requireTeamAccess(), async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { data: team, error } = await supabase
        .from('teams')
        .select(`
          *,
          members:team_members (
            id,
            role,
            joined_at,
            user:users (
              id,
              email,
              full_name,
              avatar_url
            )
          ),
          invites:team_invites (
            id,
            email,
            role,
            status,
            created_at,
            expires_at
          )
        `)
        .eq('id', req.params.teamId)
        .single();

      if (error) {
        log.error({ error }, 'Failed to get team');
        return res.status(500).json({ error: 'Failed to get team' });
      }

      res.json({ team });
    } catch (error) {
      log.error({ error }, 'Get team error');
      res.status(500).json({ error: 'Failed to get team' });
    }
  });

  /**
   * Update team
   */
  app.patch('/teams/:teamId', requireAuth, requireTeamAccess('admin'), async (req: Request, res: Response) => {
    try {
      const parsed = UpdateTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { data: team, error } = await supabase
        .from('teams')
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.teamId)
        .select()
        .single();

      if (error) {
        log.error({ error }, 'Failed to update team');
        return res.status(500).json({ error: 'Failed to update team' });
      }

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: req.params.teamId,
          user_id: req.userId,
          action: 'team.updated',
          resource_type: 'team',
          resource_id: req.params.teamId,
          metadata: parsed.data,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.json({ team });
    } catch (error) {
      log.error({ error }, 'Update team error');
      res.status(500).json({ error: 'Failed to update team' });
    }
  });

  /**
   * Delete team
   */
  app.delete('/teams/:teamId', requireAuth, requireTeamAccess('owner'), async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Check if it's a personal team
      const { data: team } = await supabase
        .from('teams')
        .select('settings')
        .eq('id', req.params.teamId)
        .single();

      if (team?.settings?.is_personal) {
        return res.status(400).json({ error: 'Cannot delete personal team' });
      }

      // Delete team (cascades to members, invites, etc.)
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', req.params.teamId);

      if (error) {
        log.error({ error }, 'Failed to delete team');
        return res.status(500).json({ error: 'Failed to delete team' });
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Delete team error');
      res.status(500).json({ error: 'Failed to delete team' });
    }
  });

  /**
   * Invite team member
   */
  app.post('/teams/:teamId/invites', requireAuth, requireTeamAccess('admin'), async (req: Request, res: Response) => {
    try {
      const parsed = InviteMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { email, role, inviteeName, message } = parsed.data;

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', req.params.teamId)
        .eq('user_id', (
          await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single()
        ).data?.id)
        .single();

      if (existingMember) {
        return res.status(400).json({ error: 'User is already a team member' });
      }

      // Check for existing pending invite
      const { data: existingInvite } = await supabase
        .from('team_invites')
        .select('id')
        .eq('team_id', req.params.teamId)
        .eq('email', email)
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        return res.status(400).json({ error: 'Pending invite already exists for this email' });
      }

      // Generate invite token
      const token = crypto.randomBytes(32).toString('hex');

      // Create invite
      const { data: invite, error } = await supabase
        .from('team_invites')
        .insert({
          team_id: req.params.teamId,
          inviter_id: req.userId,
          email,
          role,
          token,
          invitee_name: inviteeName,
          message,
        })
        .select()
        .single();

      if (error) {
        log.error({ error }, 'Failed to create invite');
        return res.status(500).json({ error: 'Failed to create invite' });
      }

      // Get team details for email
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', req.params.teamId)
        .single();

      // Send invite email
      await sendTeamInviteEmail(email, {
        teamName: team?.name || 'Team',
        inviterName: req.user?.user_metadata?.full_name || 'A team member',
        inviteeName: inviteeName || email,
        role,
        message,
        acceptUrl: `${process.env.APP_URL || 'https://nofx-control-plane.vercel.app'}/accept-invite?token=${token}`,
        expiresAt: invite.expires_at,
      });

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: req.params.teamId,
          user_id: req.userId,
          action: 'team.invite_sent',
          resource_type: 'invite',
          resource_id: invite.id,
          metadata: { email, role },
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.status(201).json({ invite: { ...invite, token: undefined } });
    } catch (error) {
      log.error({ error }, 'Invite member error');
      res.status(500).json({ error: 'Failed to invite member' });
    }
  });

  /**
   * Accept team invite
   */
  app.post('/teams/accept-invite', requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = AcceptInviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Call the database function
      const { data, error } = await supabase
        .rpc('accept_team_invite', { invite_token: parsed.data.token });

      if (error) {
        log.error({ error }, 'Failed to accept invite');
        return res.status(400).json({ error: error.message });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json({
        success: true,
        teamId: data.team_id,
        role: data.role,
      });
    } catch (error) {
      log.error({ error }, 'Accept invite error');
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  });

  /**
   * Cancel team invite
   */
  app.delete('/teams/:teamId/invites/:inviteId', requireAuth, requireTeamAccess('admin'), async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { error } = await supabase
        .from('team_invites')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.inviteId)
        .eq('team_id', req.params.teamId);

      if (error) {
        log.error({ error }, 'Failed to cancel invite');
        return res.status(500).json({ error: 'Failed to cancel invite' });
      }

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: req.params.teamId,
          user_id: req.userId,
          action: 'team.invite_cancelled',
          resource_type: 'invite',
          resource_id: req.params.inviteId,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Cancel invite error');
      res.status(500).json({ error: 'Failed to cancel invite' });
    }
  });

  /**
   * Update team member role
   */
  app.patch('/teams/:teamId/members/:memberId', requireAuth, requireTeamAccess('admin'), async (req: Request, res: Response) => {
    try {
      const parsed = UpdateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { role } = parsed.data;

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Prevent changing owner role
      const { data: member } = await supabase
        .from('team_members')
        .select('role, user_id')
        .eq('id', req.params.memberId)
        .eq('team_id', req.params.teamId)
        .single();

      if (member?.role === 'owner') {
        return res.status(400).json({ error: 'Cannot change owner role. Transfer ownership instead.' });
      }

      // Update member role
      const { error } = await supabase
        .from('team_members')
        .update({
          role,
          permissions: role === 'admin'
            ? ['read', 'write', 'admin']
            : role === 'viewer'
            ? ['read']
            : ['read', 'write'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.memberId)
        .eq('team_id', req.params.teamId);

      if (error) {
        log.error({ error }, 'Failed to update member role');
        return res.status(500).json({ error: 'Failed to update member role' });
      }

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: req.params.teamId,
          user_id: req.userId,
          action: 'team.member_role_updated',
          resource_type: 'member',
          resource_id: req.params.memberId,
          metadata: { role, user_id: member?.user_id ?? null },
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Update member role error');
      res.status(500).json({ error: 'Failed to update member role' });
    }
  });

  /**
   * Remove team member
   */
  app.delete('/teams/:teamId/members/:memberId', requireAuth, requireTeamAccess('admin'), async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Prevent removing owner
      const { data: member } = await supabase
        .from('team_members')
        .select('role, user_id')
        .eq('id', req.params.memberId)
        .eq('team_id', req.params.teamId)
        .single();

      if (member?.role === 'owner') {
        return res.status(400).json({ error: 'Cannot remove team owner' });
      }

      // Remove member
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', req.params.memberId)
        .eq('team_id', req.params.teamId);

      if (error) {
        log.error({ error }, 'Failed to remove member');
        return res.status(500).json({ error: 'Failed to remove member' });
      }

      // Log activity
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: req.params.teamId,
          user_id: req.userId,
          action: 'team.member_removed',
          resource_type: 'member',
          resource_id: req.params.memberId,
          metadata: { removed_user_id: member?.user_id ?? null },
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Remove member error');
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  /**
   * Leave team
   */
  app.post('/teams/:teamId/leave', requireAuth, requireTeamAccess(), async (req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Call database function
      const { data, error } = await supabase
        .rpc('leave_team', { p_team_id: req.params.teamId });

      if (error) {
        log.error({ error }, 'Failed to leave team');
        return res.status(400).json({ error: error.message });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Leave team error');
      res.status(500).json({ error: 'Failed to leave team' });
    }
  });

  /**
   * Transfer team ownership
   */
  app.post('/teams/:teamId/transfer-ownership', requireAuth, requireTeamAccess('owner'), async (req: Request, res: Response) => {
    try {
      const { newOwnerId } = req.body;

      if (!newOwnerId) {
        return res.status(400).json({ error: 'New owner ID is required' });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Call database function
      const { data, error } = await supabase
        .rpc('transfer_team_ownership', {
          p_team_id: req.params.teamId,
          p_new_owner_id: newOwnerId,
        });

      if (error) {
        log.error({ error }, 'Failed to transfer ownership');
        return res.status(400).json({ error: error.message });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Transfer ownership error');
      res.status(500).json({ error: 'Failed to transfer ownership' });
    }
  });
}
