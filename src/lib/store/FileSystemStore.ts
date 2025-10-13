/**
 * File system implementation of the store driver
 */

import path from 'node:path';
import fsp from 'node:fs/promises';
import { ensureDirSync } from 'fs-extra';
import { randomUUID } from 'node:crypto';
import type {
  JsonValue,
  RunRow,
  RunSummaryRow,
  StepRow,
  EventRow,
  ArtifactRow,
  ArtifactWithStepName,
  StoreDriver,
  GateRow,
  OutboxRow
} from './types';
import { FileOperationService } from './FileSystemStore/FileOperationService';
import { RunManagementService } from './FileSystemStore/RunManagementService';
import { StepManagementService } from './FileSystemStore/StepManagementService';
import { EventManagementService } from './FileSystemStore/EventManagementService';
import { ArtifactManagementService } from './FileSystemStore/ArtifactManagementService';

const ROOT = path.join(process.cwd(), 'local_data');
const FS_INBOX_KEYS = new Set<string>();

export class FileSystemStore implements StoreDriver {
  private readonly fileOps: FileOperationService;
  private readonly runManager: RunManagementService;
  private readonly stepManager: StepManagementService;
  private readonly eventManager: EventManagementService;
  private readonly artifactManager: ArtifactManagementService;

  constructor() {
    this.fileOps = new FileOperationService();
    this.runManager = new RunManagementService(this.fileOps, ROOT);
    this.stepManager = new StepManagementService(this.fileOps, ROOT);
    this.eventManager = new EventManagementService(this.fileOps, ROOT);
    this.artifactManager = new ArtifactManagementService(this.fileOps, ROOT);
  }

  async createRun(plan: JsonValue | null | undefined, projectId = 'default'): Promise<RunRow> {
    return this.runManager.createRun(plan, projectId);
  }

  async getRun(id: string): Promise<RunRow | undefined> {
    const result = await this.runManager.getRun(id);
    return result || undefined;
  }

  async updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
    return this.runManager.updateRun(id, patch);
  }

  async resetRun(id: string): Promise<void> {
    const run = await this.getRun(id);
    if (!run) return;

    const resetPatch = {
      status: 'queued' as const,
      ended_at: null,
      completed_at: null,
    };

    await this.updateRun(id, resetPatch);
  }

  async listRuns(limit = 100, projectId?: string): Promise<RunSummaryRow[]> {
    return this.runManager.listRuns(limit, projectId);
  }

  async createStep(runId: string, name: string, tool: string, inputs?: JsonValue, idempotencyKey?: string): Promise<StepRow | undefined> {
    return this.stepManager.createStep(runId, name, tool, inputs, idempotencyKey);
  }

  async getStep(id: string): Promise<StepRow | undefined> {
    return this.stepManager.getStep(id);
  }

  async getStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
    return this.stepManager.getStepByIdempotencyKey(runId, key);
  }


  async updateStep(id: string, patch: Partial<StepRow>): Promise<void> {
    return this.stepManager.updateStep(id, patch);
  }

  async resetStep(stepId: string): Promise<void> {
    const runsDir = path.join(ROOT, 'runs');
    ensureDirSync(runsDir);
    for (const runId of await fsp.readdir(runsDir)) {
      if (runId === 'index.json') continue;
      const p = path.join(runsDir, runId, 'steps', `${stepId}.json`);
      try {
        const s = await fsp.readFile(p, 'utf8');
        const step = JSON.parse(s) as StepRow;
        const next: StepRow = {
          ...step,
          status: 'queued',
          started_at: null,
          ended_at: null,
          completed_at: null,
          outputs: {}
        };
        await fsp.writeFile(p, JSON.stringify(next, null, 2));
        break;
      } catch {}
    }
  }

  async listStepsByRun(runId: string): Promise<StepRow[]> {
    return this.stepManager.listStepsByRun(runId);
  }

  async countRemainingSteps(runId: string): Promise<number> {
    const steps = await this.listStepsByRun(runId);
    return steps.filter(s => !['succeeded','cancelled'].includes(s.status)).length;
  }

  async recordEvent(runId: string, type: string, payload: JsonValue = {}, stepId?: string): Promise<void> {
    return this.eventManager.recordEvent(runId, type, payload, stepId);
  }

  async listEvents(runId: string): Promise<EventRow[]> {
    return this.eventManager.listEvents(runId);
  }

  async createOrGetGate(runId: string, stepId: string, gateType: string): Promise<GateRow | undefined> {
    const file = path.join(ROOT, 'runs', runId, 'gates.json');
    const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    let g = rows.filter(r => r.step_id === stepId && r.gate_type === gateType)
                .sort((a,b)=> (a.created_at < b.created_at ? 1 : -1))[0];
    if (!g) {
      g = {
        id: randomUUID(),
        run_id: runId,
        step_id: stepId,
        gate_type: gateType,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      rows.push(g);
      await fsp.writeFile(file, JSON.stringify(rows, null, 2));
    }
    return g;
  }

  async getLatestGate(runId: string, stepId: string): Promise<GateRow | undefined> {
    const file = path.join(ROOT, 'runs', runId, 'gates.json');
    const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    return rows.filter(r => r.step_id === stepId).sort((a,b)=> (a.created_at < b.created_at ? 1 : -1))[0];
  }

  async updateGate(id: string, patch: Partial<GateRow> & { run_id: string }): Promise<void> {
    const file = path.join(ROOT, 'runs', patch.run_id, 'gates.json');
    const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    const i = rows.findIndex(r => r.id === id);
    if (i >= 0) {
      const next = { ...rows[i], ...patch } as GateRow;
      if (patch.approved_by && !patch.approved_at) next.approved_at = new Date().toISOString();
      rows[i] = next;
      await fsp.writeFile(file, JSON.stringify(rows, null, 2));
    }
  }

  async listGatesByRun(runId: string): Promise<GateRow[]> {
    const file = path.join(ROOT, 'runs', runId, 'gates.json');
    const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    rows.sort((a,b)=> (a.created_at < b.created_at ? -1 : 1));
    return rows;
  }

  async addArtifact(stepId: string, type: string, pth: string, metadata?: JsonValue): Promise<ArtifactRow> {
    const step = await this.getStep(stepId);
    if (!step) throw new Error('step not found');
    const file = path.join(ROOT, 'runs', step.run_id, 'artifacts.json');
    const rows: ArtifactRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    const row: ArtifactRow = {
      id: randomUUID(),
      step_id: stepId,
      type,
      path: pth,
      metadata: metadata ?? {},
      created_at: new Date().toISOString(),
    };
    rows.push(row);
    await fsp.writeFile(file, JSON.stringify(rows, null, 2));
    return row;
  }

  async listArtifactsByRun(runId: string): Promise<ArtifactWithStepName[]> {
    const file = path.join(ROOT, 'runs', runId, 'artifacts.json');
    const rows: ArtifactRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    const steps = await this.listStepsByRun(runId);
    const names = new Map(steps.map(s => [s.id, s.name] as const));
    return rows.map((r) => ({ ...r, step_name: names.get(r.step_id) ?? null }));
  }

  async inboxMarkIfNew(key: string): Promise<boolean> {
    if (FS_INBOX_KEYS.has(key)) return false;
    FS_INBOX_KEYS.add(key);
    return true;
  }

  async inboxDelete(key: string): Promise<void> {
    FS_INBOX_KEYS.delete(key);
    return Promise.resolve();
  }

  async outboxAdd(topic: string, payload: JsonValue): Promise<void> {
    const file = path.join(ROOT, 'outbox.json');
    const content = await fsp.readFile(file, 'utf8').catch(() => '[]');
    const parsed = JSON.parse(content);
    const rows: OutboxRow[] = Array.isArray(parsed) ? parsed : [];
    rows.push({
      id: randomUUID(),
      topic,
      payload,
      sent: false,
      created_at: new Date().toISOString()
    });
    await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  }

  async outboxListUnsent(limit = 50): Promise<OutboxRow[]> {
    const file = path.join(ROOT, 'outbox.json');
    const rows: OutboxRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    return rows.filter(r => !r.sent).slice(0, limit);
  }

  async outboxMarkSent(id: string): Promise<void> {
    const file = path.join(ROOT, 'outbox.json');
    const rows: OutboxRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0 && rows[idx]) {
      rows[idx].sent = true;
      await fsp.writeFile(file, JSON.stringify(rows, null, 2));
    }
  }

  // User operations - not supported in FS mode
  async getUserRole(): Promise<string | null> {
    return null;
  }

  async listRunsByUser(): Promise<RunSummaryRow[]> {
    return this.listRuns();
  }

  async createRunWithUser(plan: any, projectId: string): Promise<RunRow> {
    return this.createRun(plan, projectId);
  }
}