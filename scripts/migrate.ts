#!/usr/bin/env ts-node
/**
 * Database Migration CLI
 *
 * Usage:
 *   npm run migrate:up           - Run all pending migrations
 *   npm run migrate:down <id>    - Rollback specific migration
 *   npm run migrate:status       - Show migration status
 *   npm run migrate:create <name> - Create new migration template
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  runMigration,
  rollbackMigration,
  getPendingMigrations,
  getAppliedMigrations,
  Migration
} from '../src/lib/migrations';

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

/**
 * Load all migration files from migrations directory
 */
function loadMigrations(): Migration[] {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const [upSql, downSql] = content.split('-- DOWN');

    return {
      id: file.replace('.sql', ''),
      name: file.replace(/^\d+_/, '').replace('.sql', ''),
      up: (upSql || '').replace('-- UP', '').trim(),
      down: (downSql || '').trim(),
      timestamp: new Date()
    };
  });
}

/**
 * Run all pending migrations
 */
async function migrateUp() {
  console.log('🚀 Running migrations...\n');

  const allMigrations = loadMigrations();
  const pending = await getPendingMigrations(allMigrations);

  if (pending.length === 0) {
    console.log('✅ No pending migrations');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  for (const migration of pending) {
    console.log(`⏳ Running: ${migration.name}`);
    const result = await runMigration(migration);

    if (result.success) {
      console.log(`✅ Completed: ${migration.name} (${result.duration}ms)\n`);
    } else {
      console.error(`❌ Failed: ${migration.name}`);
      console.error(`   Error: ${result.error?.message}\n`);
      process.exit(1);
    }
  }

  console.log('🎉 All migrations completed successfully');
}

/**
 * Rollback a specific migration
 */
async function migrateDown(migrationId: string) {
  console.log(`🔄 Rolling back migration: ${migrationId}\n`);

  const result = await rollbackMigration(migrationId);

  if (result.success) {
    console.log(`✅ Rollback completed (${result.duration}ms)`);
  } else {
    console.error(`❌ Rollback failed: ${result.error?.message}`);
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  console.log('📊 Migration Status\n');

  const allMigrations = loadMigrations();
  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations(allMigrations);

  console.log(`✅ Applied migrations: ${applied.length}`);
  if (applied.length > 0) {
    applied.forEach(m => {
      console.log(`   - ${m.id} (${m.timestamp.toISOString()})`);
    });
  }

  console.log(`\n⏳ Pending migrations: ${pending.length}`);
  if (pending.length > 0) {
    pending.forEach(m => {
      console.log(`   - ${m.id}`);
    });
  }

  if (pending.length === 0 && applied.length > 0) {
    console.log('\n🎉 Database is up to date!');
  }
}

/**
 * Create a new migration template
 */
function createMigration(name: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- UP
-- Write your migration SQL here
-- Example:
-- CREATE TABLE users (
--   id SERIAL PRIMARY KEY,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   created_at TIMESTAMP NOT NULL DEFAULT NOW()
-- );

-- DOWN
-- Write rollback SQL here
-- Example:
-- DROP TABLE users;
`;

  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
  console.log(`📝 Edit file: ${filepath}`);
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  try {
    switch (command) {
      case 'up':
        await migrateUp();
        break;
      case 'down':
        if (!arg) {
          console.error('❌ Usage: npm run migrate:down <migration-id>');
          process.exit(1);
        }
        await migrateDown(arg);
        break;
      case 'status':
        await showStatus();
        break;
      case 'create':
        if (!arg) {
          console.error('❌ Usage: npm run migrate:create <migration-name>');
          process.exit(1);
        }
        createMigration(arg);
        break;
      default:
        console.log(`
🗄️  Database Migration CLI

Usage:
  npm run migrate:up            Run all pending migrations
  npm run migrate:down <id>     Rollback specific migration
  npm run migrate:status        Show migration status
  npm run migrate:create <name> Create new migration template

Examples:
  npm run migrate:create "add users table"
  npm run migrate:up
  npm run migrate:status
  npm run migrate:down 20240101120000_add_users_table
        `);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
