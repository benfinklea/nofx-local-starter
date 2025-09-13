import { query } from "./db";

export async function recordEvent(runId: string, type: string, payload: any = {}, stepId?: string) {
  await query(`insert into nofx.event (run_id, type, payload) values ($1, $2, $3)`, [
    runId, type, payload
  ]);
}
