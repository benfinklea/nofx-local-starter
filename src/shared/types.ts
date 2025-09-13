import { z } from "zod";

export const StepInputSchema = z.object({
  name: z.string(),
  tool: z.string(),
  inputs: z.record(z.any()).optional()
});

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(StepInputSchema).min(1)
});

export type Plan = z.infer<typeof PlanSchema>;
