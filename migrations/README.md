# Database Migrations

This directory contains database migration files.

## Quick Start

```bash
# Create a new migration
npm run migrate:create "add email index to users"

# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate:up

# Rollback a migration (if needed)
npm run migrate:down <migration-id>
```

## Migration File Format

Migrations are `.sql` files with two sections:

```sql
-- Migration: Add email index to users
-- Created: 2024-01-01T12:00:00.000Z

-- UP
-- SQL to apply the migration
CREATE INDEX idx_users_email ON users(email);

-- DOWN
-- SQL to rollback the migration
DROP INDEX idx_users_email;
```

## Best Practices

1. **Always include a DOWN section** - Enables rollback if something goes wrong
2. **Test migrations locally first** - Run `npm run migrate:up` before deploying
3. **Keep migrations small** - One logical change per migration
4. **Use descriptive names** - "add_users_table" not "migration_1"
5. **Check for dependencies** - Ensure migrations run in correct order

## Example Migrations

### Add a Table
```sql
-- UP
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- DOWN
DROP TABLE projects;
```

### Add a Column
```sql
-- UP
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- DOWN
ALTER TABLE users DROP COLUMN email;
```

### Add an Index
```sql
-- UP
CREATE INDEX idx_runs_status ON runs(status);

-- DOWN
DROP INDEX idx_runs_status;
```

### Add a Foreign Key
```sql
-- UP
ALTER TABLE runs
  ADD CONSTRAINT fk_runs_project_id
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- DOWN
ALTER TABLE runs DROP CONSTRAINT fk_runs_project_id;
```

## Migration Safety

The migration system includes automatic safety checks:

- ✅ **Transaction wrapping** - Automatic rollback on errors
- ✅ **SQL validation** - Detects dangerous patterns (DELETE/UPDATE without WHERE)
- ✅ **Duplicate prevention** - Won't run the same migration twice
- ✅ **Migration tracking** - Stores history in `migrations` table

## Dangerous Operations

Be careful with:
- `DELETE FROM table;` (without WHERE clause)
- `UPDATE table SET ...;` (without WHERE clause)
- `TRUNCATE TABLE` (deletes all data)
- `DROP TABLE` (deletes table and all data)
- `DROP DATABASE` (deletes entire database)

The system will warn about these patterns but won't prevent them entirely (sometimes they're needed).

## Production Workflow

1. **Create migration locally**
   ```bash
   npm run migrate:create "add feature x"
   ```

2. **Write SQL**
   - Edit the generated file
   - Add both UP and DOWN sections

3. **Test locally**
   ```bash
   npm run migrate:up
   # Test your app
   # If something's wrong:
   npm run migrate:down <migration-id>
   ```

4. **Deploy**
   ```bash
   npm run ship
   ```
   Migrations will run automatically on Vercel during deployment.

## Troubleshooting

### Migration fails with "already exists"
- Someone else may have run it first
- Check `npm run migrate:status`
- If already applied, skip it

### Migration fails mid-execution
- Automatic rollback should occur
- Check `npm run migrate:status`
- Fix the SQL and try again

### Need to undo a migration
```bash
npm run migrate:down <migration-id>
```

### Want to see what's been applied
```bash
npm run migrate:status
```

## Advanced Usage

### Custom migration logic
If you need more complex migrations (data transformations, etc.), you can create TypeScript migrations instead of SQL:

```typescript
// migrations/20240101120000_complex_migration.ts
import { Migration } from '../src/lib/migrations';

export const migration: Migration = {
  id: '20240101120000_complex_migration',
  name: 'Complex data transformation',
  async up(pool) {
    // Custom TypeScript logic
    await pool.query('...');
  },
  async down(pool) {
    // Rollback logic
    await pool.query('...');
  }
};
```

---

**Remember:** Always test migrations locally before deploying!
