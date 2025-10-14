/**
 * Database Connection Helper for Backplane Store
 *
 * Provides better-sqlite3 database instances for organization management.
 * Supports both file-based databases for production and in-memory databases for testing.
 *
 * @module database
 */

/* eslint-disable no-restricted-syntax -- better-sqlite3 db.exec() is the standard method for schema initialization */

import Database from 'better-sqlite3';
import path from 'node:path';
import { log } from '../../lib/logger';

/**
 * Singleton database instance
 */
let dbInstance: Database.Database | null = null;

/**
 * Database configuration options
 */
export interface DatabaseOptions {
  /**
   * Path to the database file.
   * Use ':memory:' for in-memory database (testing).
   */
  path?: string;

  /**
   * Enable verbose logging of SQL statements
   */
  verbose?: boolean;

  /**
   * Enable readonly mode
   */
  readonly?: boolean;

  /**
   * Force creation of new database instance
   */
  forceNew?: boolean;
}

/**
 * Get or create a database instance
 *
 * Returns a singleton database instance by default.
 * Use `forceNew: true` in options to create a new instance.
 *
 * @param options - Database configuration options
 * @returns better-sqlite3 database instance
 *
 * @example
 * ```typescript
 * // Production database
 * const db = getDatabase({ path: './data/backplane.db' });
 *
 * // Test database (in-memory)
 * const testDb = getDatabase({ path: ':memory:' });
 *
 * // Force new instance
 * const newDb = getDatabase({ forceNew: true });
 * ```
 */
export function getDatabase(options: DatabaseOptions = {}): Database.Database {
  // Return existing instance if not forcing new
  if (dbInstance && !options.forceNew) {
    return dbInstance;
  }

  const dbPath = options.path || getDefaultDatabasePath();

  const db = new Database(dbPath, {
    verbose: options.verbose ? (msg: unknown) => log.debug({ sql: msg }, 'Database query') : undefined,
    readonly: options.readonly,
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrency (not for in-memory)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Initialize schema
  initializeSchema(db);

  // Store singleton if not forcing new
  if (!options.forceNew) {
    dbInstance = db;
  }

  return db;
}

/**
 * Get default database path
 *
 * Uses environment variable BACKPLANE_DB_PATH if set,
 * otherwise uses ./local_data/backplane/backplane.db
 *
 * @returns Database file path
 */
function getDefaultDatabasePath(): string {
  if (process.env.BACKPLANE_DB_PATH) {
    return process.env.BACKPLANE_DB_PATH;
  }

  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }

  return path.join(process.cwd(), 'local_data', 'backplane', 'backplane.db');
}

/**
 * Initialize database schema
 *
 * Creates all required tables for the backplane store.
 * Uses IF NOT EXISTS to avoid errors on subsequent calls.
 *
 * @param db - Database instance
 */
function initializeSchema(db: Database.Database): void {
  // Organizations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      quotas TEXT NOT NULL,
      usage TEXT NOT NULL,
      billing TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Organization members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT,
      permission_metadata TEXT,
      joined_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(organization_id, user_id)
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      repo_url TEXT,
      local_path TEXT,
      workspace_mode TEXT,
      default_branch TEXT,
      git_mode TEXT,
      initialized INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Workspaces table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      isolation_level TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Artifacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      size_bytes INTEGER,
      mime_type TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_org_members_org_id
    ON organization_members(organization_id);

    CREATE INDEX IF NOT EXISTS idx_org_members_user_id
    ON organization_members(user_id);

    CREATE INDEX IF NOT EXISTS idx_projects_org_id
    ON projects(organization_id);

    CREATE INDEX IF NOT EXISTS idx_workspaces_org_id
    ON workspaces(organization_id);

    CREATE INDEX IF NOT EXISTS idx_workspaces_project_id
    ON workspaces(project_id);

    CREATE INDEX IF NOT EXISTS idx_artifacts_org_id
    ON artifacts(organization_id);

    CREATE INDEX IF NOT EXISTS idx_artifacts_run_id
    ON artifacts(run_id);
  `);
}

/**
 * Close the database connection
 *
 * Closes the singleton database instance.
 * Should be called during application shutdown.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Reset database instance
 *
 * Closes existing instance and clears singleton.
 * Useful for testing.
 */
export function resetDatabase(): void {
  closeDatabase();
}
