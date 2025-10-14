import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach } from '@jest/globals';
import { FileSystemResponsesArchive } from '../../src/services/responses/archiveStore';
import { canonicalTextRun } from '../../src/shared/openai/responsesSchemas';

describe('FileSystemResponsesArchive', () => {
  const baseDir = path.join(os.tmpdir(), `responses-archive-test-${process.pid}-${Math.random().toString(16).slice(2)}`);

  beforeEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  it('persists runs and events on disk', async () => {
    const archive = new FileSystemResponsesArchive(baseDir);
    const run = archive.startRun({ runId: 'fs-run-1', request: canonicalTextRun });
    expect(run.status).toBe('queued');

    const event = archive.recordEvent('fs-run-1', { type: 'response.created', payload: { id: 'resp' } });
    expect(event.sequence).toBe(1);

    archive.updateStatus({ runId: 'fs-run-1', status: 'completed', result: { id: 'resp', status: 'completed', output: [] } });

    const timeline = archive.getTimeline('fs-run-1');
    expect(timeline?.events).toHaveLength(1);
    expect(timeline?.run.status).toBe('completed');

    const runs = archive.listRuns();
    expect(runs.length).toBe(1);
    expect(runs[0]!.runId).toBe('fs-run-1');

    // mark run as old and prune
    const runPath = path.join(baseDir, 'fs-run-1', 'run.json');
    const raw = JSON.parse(await fs.readFile(runPath, 'utf8'));
    raw.updatedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    await fs.writeFile(runPath, JSON.stringify(raw, null, 2));

    archive.pruneOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000));
    expect(archive.listRuns()).toHaveLength(0);
  });
});
