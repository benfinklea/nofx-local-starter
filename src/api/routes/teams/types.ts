/**
 * Types and interfaces for team management
 */

import { z } from 'zod';

// Validation schemas
export const CreateTeamSchema = z.object({
  name: z.string().min(2).max(255),
  billingEmail: z.string().email().optional(),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  billingEmail: z.string().email().optional(),
  settings: z.record(z.any()).optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  inviteeName: z.string().optional(),
  message: z.string().optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export const AcceptInviteSchema = z.object({
  token: z.string(),
});

export type CreateTeamData = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamData = z.infer<typeof UpdateTeamSchema>;
export type InviteMemberData = z.infer<typeof InviteMemberSchema>;
export type UpdateMemberRoleData = z.infer<typeof UpdateMemberRoleSchema>;
export type AcceptInviteData = z.infer<typeof AcceptInviteSchema>;