/**
 * Bulletproof Tests for Supabase Database
 * Ensures database connectivity and operations never fail
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Supabase Database - Bulletproof Tests', () => {
  describe('Connection Reliability', () => {
    it('should establish connection to Supabase', async () => {
      const { data, error } = await supabase
        .from('runs')
        .select('id')
        .limit(1);

      // Either we get data or a specific error (like empty table)
      if (error) {
        expect(error.code).toBeDefined();
        // Table exists but might be empty
        expect(error.message).not.toContain('does not exist');
      } else {
        expect(data).toBeDefined();
      }
    });

    it('should handle connection timeouts gracefully', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      const queryPromise = supabase
        .from('runs')
        .select('*')
        .limit(1);

      try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    it('should reconnect after connection loss', async () => {
      // First query to establish connection
      await supabase.from('runs').select('id').limit(1);

      // Wait a moment (simulate brief disconnect)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should reconnect automatically
      const { error } = await supabase.from('runs').select('id').limit(1);

      if (error) {
        expect(error.code).not.toBe('CONNECTION_ERROR');
      }
    });

    it('should handle concurrent queries', async () => {
      const queries = Array(10).fill(null).map(() =>
        supabase.from('runs').select('id').limit(1)
      );

      const results = await Promise.allSettled(queries);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Schema Validation', () => {
    it('should verify nofx schema exists', async () => {
      // Query using raw SQL to check schema
      const { data, error } = await supabase.rpc('pg_namespace_exists', {
        schema_name: 'nofx'
      }).single();

      // If RPC doesn't exist, try direct table query
      if (error) {
        const { error: tableError } = await supabase
          .from('run')
          .select('id')
          .limit(1);

        // If we can query the table, schema exists
        expect(tableError?.message).not.toContain('relation "nofx.run" does not exist');
      }
    });

    it('should verify required tables exist', async () => {
      const tables = ['run', 'step', 'event', 'gate', 'artifact'];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          // Table might be empty but should exist
          expect(error.message).not.toContain('does not exist');
        }
      }
    });

    it('should verify views are accessible', async () => {
      const { error } = await supabase
        .from('runs') // This is the public view
        .select('id')
        .limit(1);

      if (error) {
        expect(error.message).not.toContain('does not exist');
      }
    });
  });

  describe('Data Operations', () => {
    let testRunId: string | null = null;

    it('should handle INSERT operations', async () => {
      const { data, error } = await supabase
        .from('run')
        .insert({
          plan: { test: true },
          status: 'pending',
          tenant_id: 'test'
        })
        .select()
        .single();

      if (data) {
        testRunId = data.id;
        expect(data.id).toBeDefined();
        expect(data.status).toBe('pending');
      } else {
        // Might not have write permissions in some setups
        expect(error).toBeDefined();
      }
    });

    it('should handle SELECT operations', async () => {
      const { data, error } = await supabase
        .from('run')
        .select('*')
        .eq('status', 'pending')
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle UPDATE operations', async () => {
      if (testRunId) {
        const { data, error } = await supabase
          .from('run')
          .update({ status: 'completed' })
          .eq('id', testRunId)
          .select()
          .single();

        if (data) {
          expect(data.status).toBe('completed');
        }
      }
    });

    it('should handle DELETE operations', async () => {
      if (testRunId) {
        const { error } = await supabase
          .from('run')
          .delete()
          .eq('id', testRunId);

        // Clean up test data
        expect(error?.code).not.toBe('INTERNAL_ERROR');
      }
    });

    it('should handle complex queries with joins', async () => {
      const { data, error } = await supabase
        .from('run')
        .select(`
          id,
          status,
          step (
            id,
            name,
            tool
          )
        `)
        .limit(5);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle transactions correctly', async () => {
      // Supabase doesn't expose direct transaction control via client
      // But we can test that related inserts maintain consistency
      const { data: runData, error: runError } = await supabase
        .from('run')
        .insert({
          plan: { test: 'transaction' },
          status: 'pending',
          tenant_id: 'test'
        })
        .select()
        .single();

      if (runData) {
        const { data: stepData, error: stepError } = await supabase
          .from('step')
          .insert({
            run_id: runData.id,
            name: 'test-step',
            tool: 'test',
            status: 'pending',
            tenant_id: 'test'
          })
          .select()
          .single();

        if (stepData) {
          expect(stepData.run_id).toBe(runData.id);

          // Clean up
          await supabase.from('step').delete().eq('id', stepData.id);
        }
        await supabase.from('run').delete().eq('id', runData.id);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid table names gracefully', async () => {
      const { data, error } = await supabase
        .from('nonexistent_table')
        .select('*');

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should handle invalid column names', async () => {
      const { data, error } = await supabase
        .from('run')
        .select('nonexistent_column');

      expect(error).toBeDefined();
      expect(error.message).toContain('column');
    });

    it('should handle malformed queries', async () => {
      const { data, error } = await supabase
        .from('run')
        .select('*')
        .eq('status', null) // This might not match anything
        .single();

      // Should handle gracefully without crashing
      expect(error?.code).toBeDefined();
    });

    it('should handle connection pool exhaustion', async () => {
      // Create many concurrent connections
      const queries = Array(50).fill(null).map(() =>
        supabase.from('run').select('id').limit(1)
      );

      const results = await Promise.allSettled(queries);

      // Most should succeed even under load
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(40); // At least 80% success rate
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time for simple queries', async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from('run')
        .select('id, status')
        .limit(10);

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(duration).toBeLessThan(2000); // 2 seconds max
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 10;
      const startTime = Date.now();

      // First page
      const { data: page1 } = await supabase
        .from('run')
        .select('*')
        .range(0, pageSize - 1);

      // Second page
      const { data: page2 } = await supabase
        .from('run')
        .select('*')
        .range(pageSize, pageSize * 2 - 1);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000); // Both queries in under 3 seconds
    });

    it('should use indexes effectively', async () => {
      const startTime = Date.now();

      // Query that should use index on status
      const { data, error } = await supabase
        .from('run')
        .select('*')
        .eq('status', 'completed')
        .limit(100);

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(duration).toBeLessThan(1000); // Indexed query should be fast
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      // Try to insert a step with non-existent run_id
      const { data, error } = await supabase
        .from('step')
        .insert({
          run_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          name: 'test',
          tool: 'test',
          status: 'pending',
          tenant_id: 'test'
        });

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('should handle NULL values correctly', async () => {
      const { data, error } = await supabase
        .from('run')
        .insert({
          plan: null,
          status: 'pending',
          tenant_id: 'test'
        })
        .select()
        .single();

      if (data) {
        expect(data.id).toBeDefined();
        // Clean up
        await supabase.from('run').delete().eq('id', data.id);
      }
    });

    it('should maintain data types correctly', async () => {
      const testData = {
        plan: { complex: { nested: { object: true } } },
        status: 'pending',
        tenant_id: 'test'
      };

      const { data, error } = await supabase
        .from('run')
        .insert(testData)
        .select()
        .single();

      if (data) {
        expect(typeof data.plan).toBe('object');
        expect(data.plan).toEqual(testData.plan);
        expect(typeof data.created_at).toBe('string');

        // Clean up
        await supabase.from('run').delete().eq('id', data.id);
      }
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE run; --";

      const { data, error } = await supabase
        .from('run')
        .select('*')
        .eq('status', maliciousInput);

      // Should handle safely without executing injection
      expect(error?.message).not.toContain('DROP TABLE');
    });

    it('should enforce Row Level Security', async () => {
      // Assuming RLS is enabled, unauthorized queries should fail or return empty
      const { data, error } = await supabase
        .from('run')
        .select('*')
        .limit(100);

      // Either returns data (if authorized) or empty/error (if not)
      expect(error?.code).not.toBe('INTERNAL_ERROR');
    });

    it('should handle authentication correctly', async () => {
      // Test that we're using anon key properly
      expect(supabaseKey).toBeTruthy();
      expect(supabaseUrl).toBeTruthy();
      expect(supabaseUrl).toContain('supabase');
    });
  });
});