import { z } from "zod";

export const StepInputSchema = z.object({
  name: z.string(),
  tool: z.string(),
  inputs: z.record(z.any()).optional(),
  // Security & Policy (optional per-step)
  tools_allowed: z.array(z.string()).optional(),
  env_allowed: z.array(z.string()).optional(),
  secrets_scope: z.string().optional()
});

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(StepInputSchema).min(1)
});

export type Plan = z.infer<typeof PlanSchema>;
