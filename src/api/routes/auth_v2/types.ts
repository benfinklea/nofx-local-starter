/**
 * Authentication types and validation schemas
 */

import { z } from 'zod';

export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  companyName: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const ResetPasswordSchema = z.object({
  email: z.string().email()
});

export const UpdatePasswordSchema = z.object({
  password: z.string().min(8)
});

export type SignUpData = z.infer<typeof SignUpSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;
export type UpdatePasswordData = z.infer<typeof UpdatePasswordSchema>;

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    emailConfirmed: boolean;
  };
  session?: {
    accessToken: string;
    expiresAt: number;
  } | null;
}

export interface ApiKeyCreateData {
  name: string;
  permissions: string[];
}