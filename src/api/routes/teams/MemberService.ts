/**
 * Team member service - extracted member management logic
 */

import { createServiceClient } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import type { UpdateMemberRoleData } from './types';

export class MemberService {
  private async getSupabaseClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  async updateMemberRole(
    teamId: string,
    memberId: string,
    roleData: UpdateMemberRoleData,
    updatedBy: string
  ) {
    const supabase = await this.getSupabaseClient();

    // Get current member details
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        user:users (
          id,
          email,
          full_name
        )
      `)
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (memberError) {
      log.error({ error: memberError }, 'Failed to get member');
      throw new Error('Member not found');
    }

    // Validate role change
    this.validateRoleChange(member);

    // Update role
    const permissions = this.getRolePermissions(roleData.role);

    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update({
        role: roleData.role,
        permissions,
      })
      .eq('id', memberId)
      .eq('team_id', teamId)
      .select(`
        id,
        role,
        user:users (
          id,
          email,
          full_name
        )
      `)
      .single();

    if (updateError) {
      log.error({ error: updateError }, 'Failed to update member role');
      throw new Error('Failed to update member role');
    }

    // Log activity
    await this.logActivity(teamId, updatedBy, 'member.role_updated', 'member', memberId, {
      old_role: member.role,
      new_role: roleData.role,
      member_email: (member.user as any)?.email,
    });

    return updatedMember;
  }

  async removeMember(teamId: string, memberId: string, removedBy: string) {
    const supabase = await this.getSupabaseClient();

    // Get member details before removal
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        user:users (
          id,
          email,
          full_name
        )
      `)
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (memberError) {
      log.error({ error: memberError }, 'Failed to get member');
      throw new Error('Member not found');
    }

    // Validate removal
    this.validateMemberRemoval(member);

    // Remove member
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);

    if (error) {
      log.error({ error }, 'Failed to remove member');
      throw new Error('Failed to remove member');
    }

    // Log activity
    await this.logActivity(teamId, removedBy, 'member.removed', 'member', memberId, {
      member_email: (member.user as any)?.email,
      member_role: member.role,
    });
  }

  async leaveTeam(teamId: string, userId: string) {
    const supabase = await this.getSupabaseClient();

    // Check if user is owner
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (membership && membership.length > 0 && membership[0].role === 'owner') {
      throw new Error('Team owners cannot leave the team. Transfer ownership first.');
    }

    // Remove membership
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      log.error({ error }, 'Failed to leave team');
      throw new Error('Failed to leave team');
    }

    // Log activity
    await this.logActivity(teamId, userId, 'member.left', 'member', userId, {});
  }

  async transferOwnership(teamId: string, newOwnerId: string, currentOwnerId: string) {
    const supabase = await this.getSupabaseClient();

    // Validate new owner exists and is a team member
    const { data: newOwner, error: newOwnerError } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        user:users (
          id,
          email,
          full_name
        )
      `)
      .eq('id', newOwnerId)
      .eq('team_id', teamId)
      .single();

    if (newOwnerError) {
      log.error({ error: newOwnerError }, 'New owner not found');
      throw new Error('New owner must be a member of the team');
    }

    // Update new owner
    const { error: newOwnerUpdateError } = await supabase
      .from('team_members')
      .update({
        role: 'owner',
        permissions: ['read', 'write', 'delete', 'admin'],
      })
      .eq('id', newOwnerId)
      .eq('team_id', teamId);

    if (newOwnerUpdateError) {
      log.error({ error: newOwnerUpdateError }, 'Failed to update new owner');
      throw new Error('Failed to transfer ownership');
    }

    // Update current owner to admin
    const { error: currentOwnerUpdateError } = await supabase
      .from('team_members')
      .update({
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
      })
      .eq('user_id', currentOwnerId)
      .eq('team_id', teamId);

    if (currentOwnerUpdateError) {
      log.error({ error: currentOwnerUpdateError }, 'Failed to update current owner');
      throw new Error('Failed to transfer ownership');
    }

    // Log activity
    await this.logActivity(teamId, currentOwnerId, 'ownership.transferred', 'team', teamId, {
      new_owner_email: (newOwner.user as any)?.email,
      new_owner_id: (newOwner.user as any)?.id,
    });
  }

  private validateRoleChange(member: { role: string }) {
    if (member.role === 'owner') {
      throw new Error('Cannot change the role of the team owner');
    }
  }

  private validateMemberRemoval(member: { role: string }) {
    if (member.role === 'owner') {
      throw new Error('Cannot remove the team owner');
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