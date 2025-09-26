# Supabase Database Setup

## Quick Setup

The NOFX Control Plane requires a Supabase database with the proper schema. Follow these steps:

### 1. Create Tables

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor (under "SQL Editor" in the sidebar)
3. Open the file `run-supabase-migrations.sql` from this repository
4. Copy the entire content and paste it into the SQL editor
5. Click "Run" to execute the migration

This will create:
- The `nofx` schema with all required tables
- Indexes for optimal performance
- Row Level Security policies
- Public views for easier access
- Triggers for automatic timestamp updates

### 2. Verify Setup

After running the migration, you should see:
- Message: "All NOFX tables created successfully!"
- Tables visible in the Table Editor under the `nofx` schema

### 3. Test Connection

Visit https://nofx-control-plane.vercel.app and check the System Health widget. It should show:
- API Server: Online
- Database: Online

## Tables Created

The migration creates the following tables in the `nofx` schema:

- `run` - Stores run configurations and status
- `step` - Individual steps within runs
- `artifact` - Files and outputs from steps
- `event` - Audit trail of run events
- `gate` - Approval gates for runs
- `settings` - User settings and preferences
- `models` - Available LLM models
- `queue_jobs` - Background job queue
- `queue_history` - Job execution history

## Troubleshooting

If you see "Database offline" in the UI:

1. Check that you ran the migration script
2. Verify your environment variables in Vercel:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anon key
   - `DATABASE_URL` - Your PostgreSQL connection string

3. Check the health endpoint directly:
   ```bash
   curl https://nofx-control-plane.vercel.app/api/health
   ```

The response should include `"database": { "status": "ok" }`

## Manual Table Check

You can verify tables exist with this SQL query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'nofx'
ORDER BY table_name;
```

This should list all the NOFX tables.