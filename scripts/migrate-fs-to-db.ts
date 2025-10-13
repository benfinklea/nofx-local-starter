#!/usr/bin/env ts-node
/**
 * Migration script: Filesystem Store → Database Store
 *
 * Migrates all runs, steps, events, artifacts, and gates from local_data/ to PostgreSQL
 */

import dotenv from 'dotenv';
dotenv.config();

import path from 'node:path';
import fsp from 'node:fs/promises';
import { Pool } from 'pg';

const ROOT = path.join(process.cwd(), 'local_data');

interface RunRow {
  id: string;
  status: string;
  plan: any;
  created_at: string;
  ended_at?: string | null;
  completed_at?: string | null;
  project_id?: string;
}

interface StepRow {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  status: string;
  inputs?: any;
  outputs?: any;
  started_at?: string | null;
  ended_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  idempotency_key?: string;
}

interface EventRow {
  id: string;
  run_id: string;
  step_id?: string;
  type: string;
  payload?: any;
  created_at: string;
}

interface ArtifactRow {
  id: string;
  step_id: string;
  type: string;
  path: string;
  metadata?: any;
  created_at: string;
}

interface GateRow {
  id: string;
  run_id: string;
  step_id: string;
  gate_type: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function migrateRuns(): Promise<Map<string, RunRow>> {
  console.log('\n📦 Migrating runs...');
  const runsDir = path.join(ROOT, 'runs');
  const runs = new Map<string, RunRow>();

  try {
    const entries = await fsp.readdir(runsDir);

    for (const entry of entries) {
      if (entry === 'index.json') continue;

      const runPath = path.join(runsDir, entry, 'run.json');
      const run = await readJsonFile<RunRow>(runPath);

      if (!run) continue;

      runs.set(run.id, run);

      // Insert into database
      try {
        await pool.query(
          `INSERT INTO nofx.run (id, status, plan, created_at, ended_at, completed_at, project_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             plan = EXCLUDED.plan,
             ended_at = EXCLUDED.ended_at,
             completed_at = EXCLUDED.completed_at`,
          [
            run.id,
            run.status,
            run.plan,
            run.created_at,
            run.ended_at || null,
            run.completed_at || null,
            run.project_id || 'default'
          ]
        );
        console.log(`  ✓ Migrated run: ${run.id} (${run.status})`);
      } catch (err) {
        console.error(`  ✗ Failed to migrate run ${run.id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`✅ Migrated ${runs.size} runs`);
  } catch (err) {
    console.error('Error migrating runs:', err);
  }

  return runs;
}

async function migrateSteps(runIds: string[]): Promise<Map<string, StepRow>> {
  console.log('\n📦 Migrating steps...');
  const steps = new Map<string, StepRow>();
  let count = 0;

  for (const runId of runIds) {
    const stepsDir = path.join(ROOT, 'runs', runId, 'steps');

    try {
      const files = await fsp.readdir(stepsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const stepPath = path.join(stepsDir, file);
        const step = await readJsonFile<StepRow>(stepPath);

        if (!step) continue;

        steps.set(step.id, step);

        try {
          await pool.query(
            `INSERT INTO nofx.step (id, run_id, name, tool, status, inputs, outputs, started_at, ended_at, completed_at, created_at, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               outputs = EXCLUDED.outputs,
               started_at = EXCLUDED.started_at,
               ended_at = EXCLUDED.ended_at,
               completed_at = EXCLUDED.completed_at`,
            [
              step.id,
              step.run_id,
              step.name,
              step.tool,
              step.status,
              step.inputs || {},
              step.outputs || {},
              step.started_at || null,
              step.ended_at || null,
              step.completed_at || null,
              step.created_at,
              step.idempotency_key || null
            ]
          );
          count++;
        } catch (err) {
          console.error(`  ✗ Failed to migrate step ${step.id}:`, err instanceof Error ? err.message : String(err));
        }
      }
    } catch {
      // Steps directory doesn't exist
    }
  }

  console.log(`✅ Migrated ${count} steps`);
  return steps;
}

async function migrateEvents(runIds: string[]): Promise<void> {
  console.log('\n📦 Migrating events...');
  let count = 0;

  for (const runId of runIds) {
    const eventsDir = path.join(ROOT, 'runs', runId, 'events');

    try {
      const files = await fsp.readdir(eventsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const eventPath = path.join(eventsDir, file);
        const event = await readJsonFile<EventRow>(eventPath);

        if (!event) continue;

        try {
          await pool.query(
            `INSERT INTO nofx.event (id, run_id, step_id, type, payload, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
              event.id,
              event.run_id,
              event.step_id || null,
              event.type,
              event.payload || {},
              event.created_at
            ]
          );
          count++;
        } catch (err) {
          console.error(`  ✗ Failed to migrate event ${event.id}:`, err instanceof Error ? err.message : String(err));
        }
      }
    } catch {
      // Events directory doesn't exist
    }
  }

  console.log(`✅ Migrated ${count} events`);
}

async function migrateArtifacts(runIds: string[]): Promise<void> {
  console.log('\n📦 Migrating artifacts...');
  let count = 0;

  for (const runId of runIds) {
    const artifactsFile = path.join(ROOT, 'runs', runId, 'artifacts.json');
    const artifacts = await readJsonFile<ArtifactRow[]>(artifactsFile);

    if (!artifacts || !Array.isArray(artifacts)) continue;

    for (const artifact of artifacts) {
      try {
        await pool.query(
          `INSERT INTO nofx.artifact (id, step_id, type, path, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            artifact.id,
            artifact.step_id,
            artifact.type,
            artifact.path,
            artifact.metadata || {},
            artifact.created_at
          ]
        );
        count++;
      } catch (err) {
        console.error(`  ✗ Failed to migrate artifact ${artifact.id}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  console.log(`✅ Migrated ${count} artifacts`);
}

async function migrateGates(runIds: string[]): Promise<void> {
  console.log('\n📦 Migrating gates...');
  let count = 0;

  for (const runId of runIds) {
    const gatesFile = path.join(ROOT, 'runs', runId, 'gates.json');
    const gates = await readJsonFile<GateRow[]>(gatesFile);

    if (!gates || !Array.isArray(gates)) continue;

    for (const gate of gates) {
      try {
        await pool.query(
          `INSERT INTO nofx.gate (id, run_id, step_id, gate_type, status, approved_by, approved_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             approved_by = EXCLUDED.approved_by,
             approved_at = EXCLUDED.approved_at`,
          [
            gate.id,
            gate.run_id,
            gate.step_id,
            gate.gate_type,
            gate.status,
            gate.approved_by || null,
            gate.approved_at || null,
            gate.created_at
          ]
        );
        count++;
      } catch (err) {
        console.error(`  ✗ Failed to migrate gate ${gate.id}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  console.log(`✅ Migrated ${count} gates`);
}

async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verifying migration...');

  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM nofx.run) as run_count,
      (SELECT COUNT(*) FROM nofx.step) as step_count,
      (SELECT COUNT(*) FROM nofx.event) as event_count,
      (SELECT COUNT(*) FROM nofx.artifact) as artifact_count,
      (SELECT COUNT(*) FROM nofx.gate) as gate_count
  `);

  const counts = result.rows[0];
  console.log('\n📊 Database counts:');
  console.log(`  Runs: ${counts.run_count}`);
  console.log(`  Steps: ${counts.step_count}`);
  console.log(`  Events: ${counts.event_count}`);
  console.log(`  Artifacts: ${counts.artifact_count}`);
  console.log(`  Gates: ${counts.gate_count}`);
}

async function main() {
  console.log('🚀 Starting Filesystem → Database Migration');
  console.log('============================================\n');
  console.log(`Source: ${ROOT}`);
  console.log(`Target: ${process.env.DATABASE_URL?.split('@')[1] || 'PostgreSQL'}\n`);

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Migrate in order of dependencies
    const runs = await migrateRuns();
    const runIds = Array.from(runs.keys());

    await migrateSteps(runIds);
    await migrateEvents(runIds);
    await migrateArtifacts(runIds);
    await migrateGates(runIds);

    await verifyMigration();

    console.log('\n✅ Migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify runs appear in the UI');
    console.log('   2. Remove DATA_DRIVER=fs from .env (already using db)');
    console.log('   3. Optional: Backup and remove local_data/ directory');

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
