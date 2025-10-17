import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IncidentLog } from '../../src/services/responses/incidentLog';

describe('IncidentLog', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-log-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records and resolves incidents', () => {
    const log = new IncidentLog(tempDir);
    const incident = log.recordIncident({ runId: 'run-1', type: 'failed', sequence: 1 });
    expect(log.listIncidents({ status: 'open' })).toHaveLength(1);

    log.resolveIncident({ incidentId: incident.id, resolvedBy: 'tester' });
    expect(log.listIncidents({ status: 'open' })).toHaveLength(0);
    const resolved = log.listIncidents({ status: 'resolved' })[0];
    expect(resolved).toBeDefined();
    expect(resolved!.resolution?.resolvedBy).toBe('tester');
  });
});
