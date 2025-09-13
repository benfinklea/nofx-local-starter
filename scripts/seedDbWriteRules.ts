import dotenv from 'dotenv';
dotenv.config();
import { query } from '../src/lib/db';

async function main(){
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed in production. Set NODE_ENV to non-production to continue.');
    process.exit(2);
  }
  // Optional extra guard: require explicit confirm
  if (process.env.SEED_CONFIRM !== '1') {
    console.error('Set SEED_CONFIRM=1 to run this local seed.');
    process.exit(2);
  }

  // Minimal, safe local rule: allow inserts into nofx.event for demo/testing
  const table = 'nofx.event';
  const ops = ['insert'];
  await query(
    `insert into nofx.db_write_rule (tenant_id, table_name, allowed_ops, constraints)
     values ('local', $1, $2::text[], '{}'::jsonb)
     on conflict (tenant_id, table_name) do update set allowed_ops = excluded.allowed_ops, constraints = excluded.constraints`,
    [table, ops]
  );

  console.log('Seeded db_write_rule for', table, 'ops=', ops);
}

main().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1); });

