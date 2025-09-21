import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { query as pgQuery } from './db';

export type Project = {
  id: string;
  name: string;
  repo_url?: string | null;
  local_path?: string | null;
  workspace_mode?: 'local_path'|'clone'|'worktree';
  default_branch?: string | null;
};

function driver() {
  const queueDriver = (process.env.QUEUE_DRIVER || 'memory').toLowerCase();
  const dataDriver = process.env.DATA_DRIVER || (queueDriver === 'memory' ? 'fs' : 'db');
  return dataDriver.toLowerCase();
}
const ROOT = path.join(process.cwd(), 'local_data');
const FILE = path.join(ROOT, 'projects.json');

function ensureDirSync(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function fsRead(): Promise<Project[]> {
  ensureDirSync(ROOT);
  try { return JSON.parse(await fsp.readFile(FILE, 'utf8')); } catch { return [{ id: 'default', name: 'Default Project', local_path: process.cwd(), workspace_mode: 'local_path', default_branch: 'main' }]; }
}
async function fsWrite(rows: Project[]): Promise<void> { ensureDirSync(ROOT); await fsp.writeFile(FILE, JSON.stringify(rows, null, 2)); }

export async function listProjects(): Promise<Project[]> {
  if (driver() === 'db') {
    const r = await pgQuery<Project>(`select id, name, repo_url, local_path, workspace_mode, default_branch from nofx.project order by created_at desc`);
    return r.rows as any;
  }
  return fsRead();
}
export async function getProject(id: string): Promise<Project | undefined> {
  if (driver() === 'db') return (await pgQuery<Project>(`select * from nofx.project where id=$1`, [id])).rows[0];
  const rows = await fsRead(); return rows.find(p => p.id === id);
}
export async function createProject(p: Partial<Project>): Promise<Project> {
  if (driver() === 'db') {
    const id = p.id || `p_${Math.random().toString(36).slice(2,10)}`;
    await pgQuery(`insert into nofx.project (id, name, repo_url, local_path, workspace_mode, default_branch) values ($1,$2,$3,$4,coalesce($5,'local_path'),coalesce($6,'main'))`, [id, p.name || 'Untitled', p.repo_url || null, p.local_path || null, p.workspace_mode || 'local_path', p.default_branch || 'main']);
    return (await getProject(id))!;
  }
  const rows = await fsRead();
  const id = p.id || `p_${Math.random().toString(36).slice(2,10)}`;
  const row: Project = { id, name: p.name || 'Untitled', repo_url: p.repo_url || null, local_path: p.local_path || null, workspace_mode: (p.workspace_mode as any) || 'local_path', default_branch: p.default_branch || 'main' };
  rows.push(row); await fsWrite(rows); return row;
}
export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined> {
  if (driver() === 'db') {
    await pgQuery(`update nofx.project set name=coalesce($2,name), repo_url=coalesce($3,repo_url), local_path=coalesce($4,local_path), workspace_mode=coalesce($5,workspace_mode), default_branch=coalesce($6,default_branch) where id=$1`, [id, patch.name || null, patch.repo_url || null, patch.local_path || null, patch.workspace_mode || null, patch.default_branch || null]);
    return (await getProject(id));
  }
  const rows = await fsRead();
  const i = rows.findIndex(r => r.id === id);
  if (i === -1) return undefined;
  rows[i] = { ...rows[i], ...patch } as Project; await fsWrite(rows); return rows[i];
}
export async function deleteProject(id: string): Promise<boolean> {
  if (driver() === 'db') { await pgQuery(`delete from nofx.project where id=$1 and id<>'default'`, [id]); return true; }
  const rows = await fsRead(); const next = rows.filter(r => r.id !== id || id === 'default'); await fsWrite(next); return true;
}

export function resolveWorkspacePath(p?: Project | null): string {
  if (!p) return process.cwd();
  if (p.workspace_mode === 'local_path' && p.local_path) return p.local_path;
  // For clone/worktree modes, fallback for now to cwd; future phases will materialize workspaces
  return process.cwd();
}
