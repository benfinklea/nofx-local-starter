/**
 * Team service layer - extracted business logic
 */

import { createServiceClient } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import type { CreateTeamData, UpdateTeamData } from './types';

export class TeamService {
  private async getSupabaseClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  async listUserTeams(userId: string) {
    const supabase = await this.getSupabaseClient();

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
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) {
      log.error({ error }, 'Failed to list teams');
      throw new Error('Failed to list teams');
    }

    return teams || [];
  }

  async createTeam(teamData: CreateTeamData, userId: string, userEmail?: string) {
    const supabase = await this.getSupabaseClient();

    const { name, billingEmail } = teamData;
    const slug = this.generateSlug(name);

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        slug,
        owner_id: userId,
        billing_email: billingEmail || userEmail,
      })
      .select()
      .single();

    if (teamError) {
      log.error({ error: teamError }, 'Failed to create team');
      throw new Error('Failed to create team');
    }

    try {
      // Add creator as owner
      await this.addTeamMember(team.id, userId, 'owner');

      // Log activity
      await this.logActivity(team.id, userId, 'team.created', 'team', team.id, { name });

      return team;
    } catch (error) {
      // Clean up team if member creation fails
      await supabase.from('teams').delete().eq('id', team.id);
      throw error;
    }
  }

  async getTeamDetails(teamId: string) {
    const supabase = await this.getSupabaseClient();

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
      .eq('id', teamId)
      .single();

    if (error) {
      log.error({ error }, 'Failed to get team');
      throw new Error('Failed to get team');
    }

    return team;
  }

  async updateTeam(teamId: string, updateData: UpdateTeamData, userId: string) {
    const supabase = await this.getSupabaseClient();

    const { name, billingEmail, settings } = updateData;
    const updatePayload: Record<string, unknown> = {};

    if (name) updatePayload.name = name;
    if (billingEmail) updatePayload.billing_email = billingEmail;
    if (settings) updatePayload.settings = settings;

    const { data: team, error } = await supabase
      .from('teams')
      .update(updatePayload)
      .eq('id', teamId)
      .select()
      .single();

    if (error) {
      log.error({ error }, 'Failed to update team');
      throw new Error('Failed to update team');
    }

    // Log activity
    await this.logActivity(teamId, userId, 'team.updated', 'team', teamId, updateData);

    return team;
  }

  async deleteTeam(teamId: string, userId: string) {
    const supabase = await this.getSupabaseClient();

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      log.error({ error }, 'Failed to delete team');
      throw new Error('Failed to delete team');
    }

    // Log activity (will be stored in separate audit table if needed)
    await this.logActivity(teamId, userId, 'team.deleted', 'team', teamId, {});
  }

  private async addTeamMember(teamId: string, userId: string, role: string) {
    const supabase = await this.getSupabaseClient();

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
}