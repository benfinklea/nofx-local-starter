# Post‑merge commands (run once after all tasks are merged)

```bash
# From project root
supabase start
supabase db reset

# Create storage bucket if not created
npm run create:bucket

# Install deps once (if any agents added packages)
npm install

# Run API + worker
npm run dev
```

## Smoke tests

**Gated codegen**
```bash
curl -s -X POST http://localhost:3000/runs -H "Content-Type: application/json" -d '{
  "plan": {
    "goal": "gated codegen",
    "steps": [
      { "name": "typecheck", "tool": "gate:typecheck" },
      { "name": "lint", "tool": "gate:lint" },
      { "name": "unit", "tool": "gate:unit" },
      { "name": "generate readme", "tool": "codegen", "inputs": { "topic": "Welcome", "bullets": ["Control plane","Verification","Workers"] } }
    ]
  }
}'
open http://localhost:3000/ui/runs
```

**Manual approval**
```bash
curl -s -X POST http://localhost:3000/runs -H "Content-Type: application/json" -d '{
  "plan": { "goal": "manual deploy", "steps": [ { "name":"wait deploy approval", "tool":"manual:deploy" } ] }
}'
# Then approve in API:
# curl -X POST http://localhost:3000/gates/<GATE_ID>/approve
```

**DB write**
```bash
# (Optional) seed products table for demo
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "create table if not exists public.products(id serial primary key, name text, price int);"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "insert into nofx.db_write_rule(table_name, allowed_ops, constraints) values('public.products','{insert,update}','{}') on conflict do nothing;"

curl -s -X POST http://localhost:3000/runs -H "Content-Type: application/json" -d '{
  "plan": {
    "goal": "db write test",
    "steps": [
      { "name": "insert products", "tool": "db_write",
        "inputs": { "table": "public.products", "op":"insert", "values": [ { "name":"Widget","price":10 } ] } }
    ]
  }
}'
```
