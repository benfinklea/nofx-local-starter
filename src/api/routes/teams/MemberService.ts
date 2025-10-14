/**
 * Team member service - extracted member management logic
 */

import { createServiceClient } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import type { UpdateMemberRoleData } from './types';
import type { TeamMemberWithUser } from '../../../types/teams';
import { getRolePermissions } from '../../../types/teams';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTeamMemberWithUser, assertType } from '../../../lib/typeGuards';

/**
 * Service for managing team member operations
 */
export class MemberService {
  /**
   * Get initialized Supabase service client
   * @returns Supabase client instance
   * @throws {Error} If Supabase client cannot be initialized
   */
  private getSupabaseClient(): SupabaseClient {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable: Supabase client could not be initialized');
    }
    return supabase;
  }

  /**
   * Update a team member's role
   * @param teamId - UUID of the team
   * @param memberId - UUID of the member to update
   * @param roleData - New role data
   * @param updatedBy - UUID of the user making the update
   * @returns Updated team member with user details
   * @throws {Error} If member not found, is owner, or update fails
   */
  async updateMemberRole(
    teamId: string,
    memberId: string,
    roleData: UpdateMemberRoleData,
    updatedBy: string
  ): Promise<TeamMemberWithUser> {
    const supabase = this.getSupabaseClient();

    // Get current member details
    const { data: rawMember, error: memberError } = await supabase
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

    if (memberError || !rawMember) {
      log.error({ error: memberError }, 'Failed to get member');
      throw new Error('Member not found');
    }

    // Type-safe assertion with runtime validation
    const member = assertType(rawMember, isTeamMemberWithUser, 'Invalid member data structure from database');

    // Validate role change
    this.validateRoleChange(member);

    // Update role
    const permissions = getRolePermissions(roleData.role);

    const { data: updatedMemberRaw, error: updateError } = await supabase
      .from('team_members')
      .update({
        role: roleData.role,
        permissions: Array.from(permissions),
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

    if (updateError || !updatedMemberRaw) {
      log.error({ error: updateError }, 'Failed to update member role');
      throw new Error('Failed to update member role');
    }

    const updatedMember = assertType(updatedMemberRaw, isTeamMemberWithUser, 'Invalid updated member data structure');

    // Log activity with type-safe access
    await this.logActivity(teamId, updatedBy, 'member.role_updated', 'member', memberId, {
      old_role: member.role,
      new_role: roleData.role,
      member_email: member.user.email,
    });

    return updatedMember;
  }

  /**
   * Remove a member from a team
   * @param teamId - UUID of the team
   * @param memberId - UUID of the member to remove
   * @param removedBy - UUID of the user performing the removal
   * @throws {Error} If member not found, is owner, or removal fails
   */
  async removeMember(teamId: string, memberId: string, removedBy: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    // Get member details before removal
    const { data: rawMember, error: memberError } = await supabase
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

    if (memberError || !rawMember) {
      log.error({ error: memberError }, 'Failed to get member');
      throw new Error('Member not found');
    }

    // Type-safe assertion with runtime validation
    const member = assertType(rawMember, isTeamMemberWithUser, 'Invalid member data structure from database');

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

    // Log activity with type-safe access
    await this.logActivity(teamId, removedBy, 'member.removed', 'member', memberId, {
      member_email: member.user.email,
      member_role: member.role,
    });
  }

  /**
   * Allow a user to leave a team
   * @param teamId - UUID of the team to leave
   * @param userId - UUID of the user leaving
   * @throws {Error} If user is the team owner or leave operation fails
   */
  async leaveTeam(teamId: string, userId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    // Check if user is owner
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (membership && membership.length > 0 && membership[0] && membership[0].role === 'owner') {
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

  /**
   * Transfer team ownership to another member
   * Current owner becomes an admin
   * @param teamId - UUID of the team
   * @param newOwnerId - UUID of the member to make owner
   * @param currentOwnerId - UUID of the current owner
   * @throws {Error} If new owner not found or transfer fails
   */
  async transferOwnership(teamId: string, newOwnerId: string, currentOwnerId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    // Validate new owner exists and is a team member
    const { data: rawNewOwner, error: newOwnerError } = await supabase
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

    if (newOwnerError || !rawNewOwner) {
      log.error({ error: newOwnerError }, 'New owner not found');
      throw new Error('New owner must be a member of the team');
    }

    // Type-safe assertion with runtime validation
    const newOwner = assertType(rawNewOwner, isTeamMemberWithUser, 'Invalid new owner data structure from database');

    const ownerPermissions = getRolePermissions('owner');
    const adminPermissions = getRolePermissions('admin');

    // Update new owner
    const { error: newOwnerUpdateError } = await supabase
      .from('team_members')
      .update({
        role: 'owner',
        permissions: Array.from(ownerPermissions),
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
        permissions: Array.from(adminPermissions),
      })
      .eq('user_id', currentOwnerId)
      .eq('team_id', teamId);

    if (currentOwnerUpdateError) {
      log.error({ error: currentOwnerUpdateError }, 'Failed to update current owner');
      throw new Error('Failed to transfer ownership');
    }

    // Log activity with type-safe access
    await this.logActivity(teamId, currentOwnerId, 'ownership.transferred', 'team', teamId, {
      new_owner_email: newOwner.user.email,
      new_owner_id: newOwner.user.id,
    });
  }

  /**
   * Validate that a role change is allowed
   * @param member - Member object with role property
   * @throws {Error} If attempting to change owner role
   */
  private validateRoleChange(member: { role: string }): void {
    if (member.role === 'owner') {
      throw new Error('Cannot change the role of the team owner');
    }
  }

  /**
   * Validate that a member can be removed
   * @param member - Member object with role property
   * @throws {Error} If attempting to remove owner
   */
  private validateMemberRemoval(member: { role: string }): void {
    if (member.role === 'owner') {
      throw new Error('Cannot remove the team owner');
    }
  }

  /**
   * Log team activity for audit trail
   * @param teamId - UUID of the team
   * @param userId - UUID of the user performing the action
   * @param action - Action type (e.g., 'member.role_updated')
   * @param resourceType - Type of resource affected
   * @param resourceId - ID of the affected resource
   * @param metadata - Additional metadata about the action
   */
  private async logActivity(
    teamId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
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
        ip_address: null,
        user_agent: null,
      });
  }
}