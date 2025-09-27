export interface Step {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  inputs: Record<string, any>;
}
export interface StepHandler {
  /** match a tool exactly or by regex */
  match(tool: string): boolean;
  run(ctx: { runId: string; step: Step }): Promise<void>;
}