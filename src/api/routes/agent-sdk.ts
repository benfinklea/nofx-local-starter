/**
 * Agent SDK Monitoring and Analytics Routes
 * Phase 3A: Testing & Deployment Readiness
 */

import { Router, Request, Response } from 'express';
import { query } from '../../lib/db';
import { log } from '../../lib/logger';

const router = Router();

/**
 * GET /api/sdk/health
 * Health check for Agent SDK integration
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sdk: {
        installed: true,
        version: '0.1.0',
        enabled: process.env.USE_AGENT_SDK === 'true',
      },
      config: {
        defaultModel: process.env.AGENT_SDK_MODEL || 'claude-sonnet-4-5',
        maxTokens: parseInt(process.env.AGENT_SDK_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.AGENT_SDK_TEMPERATURE || '0.7'),
      },
      apiKey: {
        configured: !!process.env.ANTHROPIC_API_KEY,
        // Don't expose the actual key
        present: process.env.ANTHROPIC_API_KEY ? 'sk-ant-***' : 'missing',
      },
    };

    res.json(healthData);
  } catch (error) {
    log.error({ error }, 'SDK health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/sdk/stats
 * Usage statistics for Agent SDK
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;

    // Calculate date range
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Query SDK usage stats
    const stats = await query<{
      total_runs: string;
      sdk_runs: string;
      total_tokens: string;
      total_cost: string;
      avg_tokens_per_step: string;
    }>(
      `
      SELECT
        COUNT(DISTINCT r.id) as total_runs,
        COUNT(DISTINCT CASE WHEN r.sdk_session_id IS NOT NULL THEN r.id END) as sdk_runs,
        COALESCE(SUM((s.outputs->>'tokensUsed')::int), 0) as total_tokens,
        COALESCE(SUM((s.outputs->>'cost')::numeric), 0) as total_cost,
        COALESCE(AVG((s.outputs->>'tokensUsed')::int), 0) as avg_tokens_per_step
      FROM nofx.run r
      LEFT JOIN nofx.step s ON s.run_id = r.id
      WHERE r.created_at >= $1
        AND r.sdk_session_id IS NOT NULL
      `,
      [startDate]
    );

    // Query daily breakdown
    const dailyStats = await query<{
      date: string;
      sdk_runs: string;
      total_tokens: string;
      total_cost: string;
    }>(
      `
      SELECT
        DATE_TRUNC('day', r.created_at)::date as date,
        COUNT(DISTINCT r.id) as sdk_runs,
        COALESCE(SUM((s.outputs->>'tokensUsed')::int), 0) as total_tokens,
        COALESCE(SUM((s.outputs->>'cost')::numeric), 0) as total_cost
      FROM nofx.run r
      LEFT JOIN nofx.step s ON s.run_id = r.id
      WHERE r.created_at >= $1
        AND r.sdk_session_id IS NOT NULL
      GROUP BY DATE_TRUNC('day', r.created_at)
      ORDER BY date DESC
      `,
      [startDate]
    );

    const summary = stats.rows[0] || {
      total_runs: '0',
      sdk_runs: '0',
      total_tokens: '0',
      total_cost: '0',
      avg_tokens_per_step: '0',
    };

    res.json({
      period,
      summary: {
        totalRuns: parseInt(summary.total_runs),
        sdkRuns: parseInt(summary.sdk_runs),
        totalTokens: parseInt(summary.total_tokens),
        totalCost: parseFloat(summary.total_cost),
        avgTokensPerStep: Math.round(parseFloat(summary.avg_tokens_per_step)),
        sdkAdoptionRate:
          parseInt(summary.total_runs) > 0
            ? ((parseInt(summary.sdk_runs) / parseInt(summary.total_runs)) * 100).toFixed(1)
            : '0.0',
      },
      daily: dailyStats.rows.map((row: { date: string; sdk_runs: string; total_tokens: string; total_cost: string }) => ({
        date: row.date,
        runs: parseInt(row.sdk_runs),
        tokens: parseInt(row.total_tokens),
        cost: parseFloat(row.total_cost),
      })),
      thresholds: {
        costAlertThreshold: parseFloat(process.env.AGENT_SDK_COST_ALERT_THRESHOLD || '10.00'),
        costDailyLimit: parseFloat(process.env.AGENT_SDK_COST_DAILY_LIMIT || '100.00'),
        alertTriggered: parseFloat(summary.total_cost) > parseFloat(process.env.AGENT_SDK_COST_ALERT_THRESHOLD || '10.00'),
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch SDK stats');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    });
  }
});

/**
 * GET /api/sdk/sessions
 * Active SDK sessions with session persistence stats
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;

    const sessions = await query<{
      sdk_session_id: string;
      run_id: string;
      created_at: string;
      status: string;
      step_count: string;
      total_tokens: string;
      total_cost: string;
      last_activity: string;
    }>(
      `
      SELECT
        r.sdk_session_id,
        r.id as run_id,
        r.created_at,
        r.status,
        COUNT(s.id) as step_count,
        COALESCE(SUM((s.outputs->>'tokensUsed')::int), 0) as total_tokens,
        COALESCE(SUM((s.outputs->>'cost')::numeric), 0) as total_cost,
        MAX(s.updated_at) as last_activity
      FROM nofx.run r
      LEFT JOIN nofx.step s ON s.run_id = r.id
      WHERE r.sdk_session_id IS NOT NULL
      GROUP BY r.sdk_session_id, r.id, r.created_at, r.status
      ORDER BY r.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json({
      sessions: sessions.rows.map((row: {
        sdk_session_id: string;
        run_id: string;
        created_at: string;
        status: string;
        step_count: string;
        total_tokens: string;
        total_cost: string;
        last_activity: string;
      }) => ({
        sessionId: row.sdk_session_id,
        runId: row.run_id,
        createdAt: row.created_at,
        status: row.status,
        stepCount: parseInt(row.step_count),
        totalTokens: parseInt(row.total_tokens),
        totalCost: parseFloat(row.total_cost),
        lastActivity: row.last_activity,
      })),
      count: sessions.rows.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch SDK sessions');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch sessions',
    });
  }
});

/**
 * GET /api/sdk/compare
 * Compare SDK vs legacy model router performance
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;

    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const comparison = await query<{
      method: string;
      run_count: string;
      avg_duration_seconds: string;
      total_cost: string;
      avg_cost_per_run: string;
      success_rate: string;
    }>(
      `
      SELECT
        CASE
          WHEN r.sdk_session_id IS NOT NULL THEN 'SDK'
          ELSE 'Legacy'
        END as method,
        COUNT(DISTINCT r.id) as run_count,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))) as avg_duration_seconds,
        COALESCE(SUM((s.outputs->>'cost')::numeric), 0) as total_cost,
        COALESCE(AVG((s.outputs->>'cost')::numeric), 0) as avg_cost_per_run,
        (COUNT(DISTINCT CASE WHEN r.status = 'succeeded' THEN r.id END)::numeric / NULLIF(COUNT(DISTINCT r.id), 0) * 100) as success_rate
      FROM nofx.run r
      LEFT JOIN nofx.step s ON s.run_id = r.id
      WHERE r.created_at >= $1
      GROUP BY method
      `,
      [startDate]
    );

    const results = {
      SDK: comparison.rows.find((r: { method: string }) => r.method === 'SDK') || null,
      Legacy: comparison.rows.find((r: { method: string }) => r.method === 'Legacy') || null,
    };

    res.json({
      period,
      comparison: {
        sdk: results.SDK
          ? {
              runCount: parseInt(results.SDK.run_count),
              avgDuration: parseFloat(results.SDK.avg_duration_seconds),
              totalCost: parseFloat(results.SDK.total_cost),
              avgCostPerRun: parseFloat(results.SDK.avg_cost_per_run),
              successRate: parseFloat(results.SDK.success_rate),
            }
          : null,
        legacy: results.Legacy
          ? {
              runCount: parseInt(results.Legacy.run_count),
              avgDuration: parseFloat(results.Legacy.avg_duration_seconds),
              totalCost: parseFloat(results.Legacy.total_cost),
              avgCostPerRun: parseFloat(results.Legacy.avg_cost_per_run),
              successRate: parseFloat(results.Legacy.success_rate),
            }
          : null,
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to compare SDK vs Legacy');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to compare',
    });
  }
});

export default router;
