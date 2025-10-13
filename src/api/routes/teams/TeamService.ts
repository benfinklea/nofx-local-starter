/**
 * Team service layer - extracted business logic
 */

import { z } from 'zod';
import { createServiceClient } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import type { CreateTeamData, UpdateTeamData } from './types';

// Input validation schemas (HEAVY MODE reliability pattern)
const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be 100 characters or less'),
  billingEmail: z.string().email('Invalid email address').optional()
});

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billingEmail: z.string().email().optional(),
  settings: z.record(z.unknown()).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

const UserIdSchema = z.string().uuid('Invalid user ID format');
const TeamIdSchema = z.string().uuid('Invalid team ID format');

export class TeamService {
  private getSupabaseClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  async listUserTeams(userId: string) {
    // Validate input
    const validatedUserId = UserIdSchema.parse(userId);

    const supabase = this.getSupabaseClient();

    const { data: teams, error} = await supabase
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
      .eq('user_id', validatedUserId)
      .order('joined_at', { ascending: false });

    if (error) {
      log.error({ error }, 'Failed to list teams');
      throw new Error('Failed to list teams');
    }

    return teams || [];
  }

  async createTeam(teamData: CreateTeamData, userId: string, userEmail?: string) {
    // Validate inputs
    const validated = CreateTeamSchema.parse(teamData);
    const validatedUserId = UserIdSchema.parse(userId);

    const supabase = this.getSupabaseClient();

    const { name, billingEmail } = validated;
    const slug = this.generateSlug(name);

    // Ensure slug is not empty (edge case protection)
    if (!slug || slug === '' || slug === '-') {
      throw new Error('Team name must contain at least one alphanumeric character');
    }

    // Use Supabase RPC for atomic transaction (if available)
    // This ensures team and member are created together or rolled back
    const { data: result, error } = await supabase.rpc('create_team_with_owner', {
      p_name: name,
      p_slug: slug,
      p_owner_id: validatedUserId,
      p_billing_email: billingEmail || userEmail
    }).select().single().catch(() => ({ data: null, error: null }));

    // If RPC not available, fall back to manual transaction with cleanup
    if (!result) {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name,
          slug,
          owner_id: validatedUserId,
          billing_email: billingEmail || userEmail,
        })
        .select()
        .single();

      if (teamError) {
        log.error({ error: teamError }, 'Failed to create team');
        throw new Error('Failed to create team');
      }

      try {
        // Add creator as owner (must succeed or rollback)
        await this.addTeamMember(team.id, validatedUserId, 'owner');

        // Log activity (best-effort, don't fail if this errors)
        await this.logActivity(team.id, validatedUserId, 'team.created', 'team', team.id, { name })
          .catch(err => log.warn({ error: err }, 'Failed to log team creation activity'));

        return team;
      } catch (error) {
        // ROLLBACK: Clean up team if member creation fails
        log.warn({ teamId: team.id, error }, 'Rolling back team creation due to member add failure');
        await supabase.from('teams').delete().eq('id', team.id).catch(rollbackError => {
          log.error({ teamId: team.id, rollbackError }, 'Failed to rollback team creation');
        });
        throw error;
      }
    }

    // RPC succeeded, log activity
    await this.logActivity(result.id, validatedUserId, 'team.created', 'team', result.id, { name })
      .catch(err => log.warn({ error: err }, 'Failed to log team creation activity'));

    if (error) {
      log.error({ error }, 'Failed to create team via RPC');
      throw new Error('Failed to create team');
    }

    return result;
  }

  async getTeamDetails(teamId: string) {
    // Validate input
    const validatedTeamId = TeamIdSchema.parse(teamId);

    const supabase = this.getSupabaseClient();

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
      .eq('id', validatedTeamId)
      .single();

    if (error) {
      log.error({ error }, 'Failed to get team');
      throw new Error('Failed to get team');
    }

    return team;
  }

  async updateTeam(teamId: string, updateData: UpdateTeamData, userId: string) {
    // Validate inputs
    const validatedTeamId = TeamIdSchema.parse(teamId);
    const validated = UpdateTeamSchema.parse(updateData);
    const validatedUserId = UserIdSchema.parse(userId);

    const supabase = this.getSupabaseClient();

    // ✅ PERMISSION CHECK: Verify user has permission to update team
    const hasPermission = await this.checkUserPermission(validatedTeamId, validatedUserId, 'write');
    if (!hasPermission) {
      log.warn({ teamId: validatedTeamId, userId: validatedUserId }, 'Unauthorized team update attempt');
      throw new Error('Insufficient permissions to update team');
    }

    const { name, billingEmail, settings } = validated;
    const updatePayload: Record<string, unknown> = {};

    if (name) updatePayload.name = name;
    if (billingEmail) updatePayload.billing_email = billingEmail;
    if (settings) updatePayload.settings = settings;

    const { data: team, error } = await supabase
      .from('teams')
      .update(updatePayload)
      .eq('id', validatedTeamId)
      .select()
      .single();

    if (error) {
      log.error({ error }, 'Failed to update team');
      throw new Error('Failed to update team');
    }

    // Log activity (best-effort)
    await this.logActivity(validatedTeamId, validatedUserId, 'team.updated', 'team', validatedTeamId, validated)
      .catch(err => log.warn({ error: err }, 'Failed to log team update activity'));

    return team;
  }

  async deleteTeam(teamId: string, userId: string) {
    // Validate inputs
    const validatedTeamId = TeamIdSchema.parse(teamId);
    const validatedUserId = UserIdSchema.parse(userId);

    const supabase = this.getSupabaseClient();

    // ✅ PERMISSION CHECK: Verify user is team owner before deletion
    const isOwner = await this.checkUserIsOwner(validatedTeamId, validatedUserId);
    if (!isOwner) {
      log.warn({ teamId: validatedTeamId, userId: validatedUserId }, 'Unauthorized team deletion attempt');
      throw new Error('Only team owners can delete teams');
    }

    // Log activity BEFORE deletion (so we have record even if delete fails)
    await this.logActivity(validatedTeamId, validatedUserId, 'team.delete_attempted', 'team', validatedTeamId, {})
      .catch(err => log.warn({ error: err }, 'Failed to log team deletion attempt'));

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', validatedTeamId);

    if (error) {
      log.error({ error }, 'Failed to delete team');
      throw new Error('Failed to delete team');
    }

    // Log successful deletion
    await this.logActivity(validatedTeamId, validatedUserId, 'team.deleted', 'team', validatedTeamId, {})
      .catch(err => log.warn({ error: err }, 'Failed to log team deletion success'));
  }

  private async addTeamMember(teamId: string, userId: string, role: string) {
    const supabase = this.getSupabaseClient();

    const permissions = this.getRolePermissions(role);

    const { error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        permissions,
      });

    if (error) {
      log.error({ error }, 'Failed to add team member');
      throw new Error('Failed to add team member');
    }
  }

  private async logActivity(
    teamId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ) {
    const supabase = this.getSupabaseClient();

    await supabase
      .from('team_activity_logs')
      .insert({
        team_id: teamId,
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
  }

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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

  /**
   * Check if user has specific permission on team
   * @param teamId Team ID
   * @param userId User ID
   * @param permission Required permission (read, write, delete, admin)
   * @returns true if user has permission
   */
  private async checkUserPermission(teamId: string, userId: string, permission: string): Promise<boolean> {
    const supabase = this.getSupabaseClient();

    const { data: member, error } = await supabase
      .from('team_members')
      .select('role, permissions')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      return false;
    }

    // Check if user has the required permission
    const permissions = member.permissions as string[] || this.getRolePermissions(member.role);
    return permissions.includes(permission);
  }

  /**
   * Check if user is team owner
   * @param teamId Team ID
   * @param userId User ID
   * @returns true if user is owner
   */
  private async checkUserIsOwner(teamId: string, userId: string): Promise<boolean> {
    const supabase = this.getSupabaseClient();

    // Check both team.owner_id and team_members.role
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamId)
      .single();

    if (team && team.owner_id === userId) {
      return true;
    }

    // Also check team_members table
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    return member?.role === 'owner';
  }
}