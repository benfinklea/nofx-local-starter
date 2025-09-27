/**
 * Runtime Data Service - extracted from runtime.ts
 * Handles data management operations like pruning and export
 */

import type { RuntimeBundle } from '../runtime';

export class RuntimeDataService {
  constructor(private runtime: RuntimeBundle) {}

  pruneOlderThanDays(days: number): void {
    if (days <= 0) {
      throw new Error('Days must be positive');
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (typeof this.runtime.archive.pruneOlderThan === 'function') {
      this.runtime.archive.pruneOlderThan(cutoff);
    }

    // Also clean up related data
    if (typeof this.runtime.archive.deleteRun === 'function') {
      // Additional cleanup logic could go here
    }
  }

  async exportRun(runId: string): Promise<string> {
    if (typeof this.runtime.archive.exportRun === 'function') {
      return await this.runtime.archive.exportRun(runId);
    }

    // Fallback: basic JSON export
    const run = this.runtime.archive.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const timeline = this.runtime.archive.getTimeline(runId);
    const events = timeline?.events || [];
    const exportData = {
      run,
      events,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async exportAllRuns(): Promise<string> {
    const runs = this.runtime.archive.listRuns();
    const exportData = {
      runs: runs.map(run => ({
        ...run,
        events: this.runtime.archive.getTimeline(run.runId)?.events || [],
      })),
      exportedAt: new Date().toISOString(),
      totalRuns: runs.length,
    };

    return JSON.stringify(exportData, null, 2);
  }

  getStorageStats() {
    const runs = this.runtime.archive.listRuns();
    let totalSize = 0;
    let oldestRun: Date | null = null;
    let newestRun: Date | null = null;

    for (const run of runs) {
      // Estimate size (rough calculation)
      const runSize = JSON.stringify(run).length;
      const timeline = this.runtime.archive.getTimeline(run.runId);
      const events = timeline?.events || [];
      const eventsSize = JSON.stringify(events).length;
      totalSize += runSize + eventsSize;

      if (!oldestRun || run.createdAt < oldestRun) {
        oldestRun = run.createdAt;
      }
      if (!newestRun || run.createdAt > newestRun) {
        newestRun = run.createdAt;
      }
    }

    return {
      totalRuns: runs.length,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestRun: oldestRun?.toISOString(),
      newestRun: newestRun?.toISOString(),
      timeSpanDays: oldestRun && newestRun
        ? Math.ceil((newestRun.getTime() - oldestRun.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
    };
  }
}