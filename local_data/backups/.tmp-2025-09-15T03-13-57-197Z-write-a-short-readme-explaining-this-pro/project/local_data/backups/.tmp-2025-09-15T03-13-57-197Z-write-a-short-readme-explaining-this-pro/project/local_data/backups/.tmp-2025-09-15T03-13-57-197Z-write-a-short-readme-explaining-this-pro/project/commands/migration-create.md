---
name: migration-create
description: Plan and create safe database/infrastructure migrations with rollback strategies
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: COMPREHENSIVE MIGRATION PLAN**
Creating migrations for all pending schema changes and infrastructure updates...
{{else}}
**Mode: INCREMENTAL MIGRATION**
Focusing on recent model or schema changes. I will:
1. Create migrations for recently modified models
2. Handle schema changes in current development
3. Focus on database changes you've recently discussed

To create migrations for all pending changes, use: `/migration-create --all`
{{/if}}

Create comprehensive migration plans for database schema changes, data transformations, and infrastructure updates:

## Migration Planning

### 1. Impact Analysis
**Pre-Migration Assessment:**
- Current schema/infrastructure state
- Dependencies and foreign keys
- Data volume and growth rate
- Application touchpoints
- Performance implications
- Downtime requirements
- Rollback complexity

### 2. Migration Strategy Selection

**Zero-Downtime Migration Pattern:**
```sql
-- Phase 1: Add backward-compatible changes
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Phase 2: Dual-write period (application writes to both old and new)
-- Application code handles both schemas

-- Phase 3: Backfill data
UPDATE users SET email_verified = (email_confirmed_at IS NOT NULL) 
WHERE email_verified IS NULL;

-- Phase 4: Switch reads to new column
-- Update application to use new column

-- Phase 5: Stop writes to old column
-- Remove old column references from code

-- Phase 6: Clean up (after safety period)
ALTER TABLE users DROP COLUMN email_confirmed_at;
```

## Database Migrations

### Schema Migration Template
```javascript
// Migration file: 20240120_add_user_preferences.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // Create new table
      await queryInterface.createTable('user_preferences', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        user_id: {
          type: Sequelize.UUID,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          allowNull: false
        },
        theme: {
          type: Sequelize.ENUM('light', 'dark', 'auto'),
          defaultValue: 'auto'
        },
        notifications_enabled: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      }, { transaction: t });
      
      // Add indexes
      await queryInterface.addIndex(
        'user_preferences',
        ['user_id'],
        { unique: true, transaction: t }
      );
      
      // Migrate existing data
      await queryInterface.sequelize.query(`
        INSERT INTO user_preferences (id, user_id, created_at, updated_at)
        SELECT gen_random_uuid(), id, NOW(), NOW()
        FROM users
        WHERE NOT EXISTS (
          SELECT 1 FROM user_preferences WHERE user_id = users.id
        )
      `, { transaction: t });
    });
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // Remove indexes first
      await queryInterface.removeIndex(
        'user_preferences',
        ['user_id'],
        { transaction: t }
      );
      
      // Drop table
      await queryInterface.dropTable('user_preferences', { transaction: t });
    });
  },
  
  // Validation
  validate: async (queryInterface) => {
    const [results] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as orphaned
      FROM user_preferences p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE u.id IS NULL
    `);
    
    if (results[0].orphaned > 0) {
      throw new Error(`Found ${results[0].orphaned} orphaned preferences`);
    }
  }
};
```

### Data Migration Patterns

**Large Table Migration:**
```sql
-- Batch processing for large tables
DO $$
DECLARE
  batch_size INTEGER := 10000;
  offset_val INTEGER := 0;
  total_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM large_table;
  
  WHILE offset_val < total_rows LOOP
    -- Process batch
    UPDATE large_table 
    SET new_column = calculate_value(old_column)
    WHERE id IN (
      SELECT id FROM large_table 
      WHERE new_column IS NULL
      ORDER BY id
      LIMIT batch_size
    );
    
    -- Progress tracking
    RAISE NOTICE 'Processed % of % rows', offset_val, total_rows;
    
    -- Prevent lock escalation
    PERFORM pg_sleep(0.1);
    
    offset_val := offset_val + batch_size;
  END LOOP;
END $$;
```

**Complex Data Transformation:**
```javascript
class DataMigration {
  async migrate() {
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batch = await this.fetchBatch(offset, batchSize);
      
      if (batch.length === 0) {
        hasMore = false;
        continue;
      }
      
      const transformed = await this.transformBatch(batch);
      await this.writeBatch(transformed);
      
      // Verify migration
      await this.verifyBatch(batch, transformed);
      
      // Update progress
      await this.updateProgress(offset, batch.length);
      
      offset += batchSize;
      
      // Rate limiting
      await this.sleep(100);
    }
  }
  
  async transformBatch(records) {
    return records.map(record => ({
      ...record,
      // Complex transformation logic
      normalized_email: record.email.toLowerCase().trim(),
      full_name: `${record.first_name} ${record.last_name}`.trim(),
      metadata: JSON.stringify({
        migrated_at: new Date(),
        original_format: 'v1',
        migration_version: '2.0.0'
      })
    }));
  }
  
  async verifyBatch(original, transformed) {
    // Verify data integrity
    for (let i = 0; i < original.length; i++) {
      if (original[i].id !== transformed[i].id) {
        throw new Error(`ID mismatch at index ${i}`);
      }
      
      // Additional validation
      if (!this.isValidEmail(transformed[i].normalized_email)) {
        throw new Error(`Invalid email for ID ${original[i].id}`);
      }
    }
  }
}
```

## Infrastructure Migrations

### Blue-Green Deployment
```yaml
# Kubernetes rolling update strategy
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: app
        image: myapp:v2.0.0
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Service Mesh Migration
```yaml
# Gradual traffic shifting with Istio
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app-migration
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: app-v2
      weight: 100
  - route:
    - destination:
        host: app-v1
      weight: 90
    - destination:
        host: app-v2
      weight: 10  # Start with 10% traffic
```

## Rollback Strategies

### Database Rollback Plan
```sql
-- Backup before migration
CREATE TABLE users_backup_20240120 AS SELECT * FROM users;

-- Rollback procedure
BEGIN;
  -- Restore from backup
  TRUNCATE users;
  INSERT INTO users SELECT * FROM users_backup_20240120;
  
  -- Verify restoration
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM users_backup_20240120;
  
  -- If counts match, commit
  COMMIT;
-- If issues, ROLLBACK;
```

### Application Rollback
```javascript
// Feature flag for safe rollback
const migrationConfig = {
  useNewSchema: process.env.USE_NEW_SCHEMA === 'true',
  dualWrite: process.env.DUAL_WRITE === 'true',
  
  async executeQuery(query) {
    if (this.useNewSchema) {
      return await this.newSchemaQuery(query);
    } else {
      return await this.oldSchemaQuery(query);
    }
  },
  
  async writeData(data) {
    if (this.dualWrite) {
      await Promise.all([
        this.writeToOldSchema(data),
        this.writeToNewSchema(data)
      ]);
    } else if (this.useNewSchema) {
      await this.writeToNewSchema(data);
    } else {
      await this.writeToOldSchema(data);
    }
  }
};
```

## Migration Testing

### Test Migration Script
```bash
#!/bin/bash

# Test migration in isolated environment
echo "Creating test database..."
createdb migration_test

echo "Copying production schema..."
pg_dump -s production_db | psql migration_test

echo "Loading sample data..."
psql migration_test < sample_data.sql

echo "Running migration..."
npm run migrate:up -- --env=test

echo "Validating migration..."
npm run migrate:validate -- --env=test

echo "Testing rollback..."
npm run migrate:down -- --env=test

echo "Cleanup..."
dropdb migration_test

echo "Migration test complete!"
```

### Validation Queries
```sql
-- Data integrity checks
SELECT 
  'Missing references' as check_name,
  COUNT(*) as failures
FROM child_table c
LEFT JOIN parent_table p ON c.parent_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 
  'Duplicate entries' as check_name,
  COUNT(*) - COUNT(DISTINCT unique_column) as failures
FROM migrated_table

UNION ALL

SELECT 
  'Null critical fields' as check_name,
  COUNT(*) as failures
FROM migrated_table
WHERE critical_field IS NULL;
```

## Migration Checklist

### Pre-Migration
- [ ] Backup all affected data
- [ ] Test migration in staging
- [ ] Prepare rollback scripts
- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Update documentation
- [ ] Prepare monitoring dashboards

### During Migration
- [ ] Enable maintenance mode
- [ ] Run pre-migration validation
- [ ] Execute migration scripts
- [ ] Verify data integrity
- [ ] Run post-migration validation
- [ ] Update application configuration
- [ ] Clear caches

### Post-Migration
- [ ] Smoke test critical paths
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify data consistency
- [ ] Remove maintenance mode
- [ ] Document lessons learned
- [ ] Schedule cleanup tasks

## Success Criteria
- Zero data loss
- Migration completed within window
- All validations pass
- Performance maintained or improved
- Rollback plan tested and ready
- No unexpected downtime
- All dependencies updated

Create comprehensive migration plan now with proper testing, validation, and rollback strategies.

## Command Completion

✅ `/migration-create $ARGUMENTS` command complete.

Summary: Created safe migration plan with zero-downtime strategy, comprehensive testing, and verified rollback procedures.