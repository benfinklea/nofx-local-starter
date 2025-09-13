import * as dotenv from 'dotenv';
dotenv.config();
import PgBoss from 'pg-boss';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const queueName = process.env.JOB_QUEUE || 'step_ready';
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL as string, schema: process.env.BOSS_SCHEMA || 'pgboss' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL as string });

async function run() {
  await boss.start();
  console.log('Worker started');
  await boss.work(queueName, async (job) => {
    const { stepId } = job.data as any;
    console.log('Working step', stepId);
    // Fetch step + run
    const step = (await pool.query('select * from nofx.step where id = $1', [stepId])).rows[0];
    const run = (await pool.query('select * from nofx.run where id = $1', [step.run_id])).rows[0];
    // Mark running
    await pool.query("update nofx.step set status='running', started_at=now() where id=$1", [stepId]);
    await pool.query("insert into nofx.event (run_id, step_id, type, payload) values ($1,$2,'step.start',$3)",
      [step.run_id, stepId, JSON.stringify({ name: step.name })]);
    // Do trivial "codegen" demo
    const content = `// Generated for plan goal: ${run.plan?.goal || 'n/a'}\nexport const hello = () => '${(step.inputs?.text) || 'Hello'}';\n`;
    const artifactId = uuidv4();
    // Store artifact as a file path URI under local /tmp for demo; in Supabase cloud use Storage SDK
    const fs = await import('fs/promises');
    const path = `/tmp/nofx_artifact_${artifactId}.ts`;
    await fs.writeFile(path, content, 'utf8');
    await pool.query(
      "insert into nofx.artifact (id, step_id, type, uri, hash, metadata) values ($1,$2,$3,$4,$5,$6)",
      [artifactId, stepId, 'code', `file://${path}`, null, JSON.stringify({})]
    );
    // Finish
    await pool.query("update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1",
      [stepId, JSON.stringify({ artifactId, path })]);
    await pool.query("update nofx.run set status='succeeded', ended_at=now() where id=$1 and not exists (select 1 from nofx.step where run_id=$1 and status not in ('succeeded','cancelled'))", [step.run_id]);
    await pool.query("insert into nofx.event (run_id, step_id, type, payload) values ($1,$2,'step.finish',$3)",
      [step.run_id, stepId, JSON.stringify({ artifactId, path })]);
    return 'ok';
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
