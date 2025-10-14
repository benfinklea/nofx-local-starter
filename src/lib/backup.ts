import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { store } from './store';
import { supabase, ARTIFACT_BUCKET } from './supabase';
import { query } from './db';

export type BackupMeta = {
  id: string;
  created_at: string;
  title: string;
  note?: string;
  size_bytes?: number;
  kind: 'fs'|'db';
  scope?: BackupScope;
  cloud?: { uploaded?: boolean; path?: string; error?: string };
};

export type BackupScope = 'data'|'with-project'|'project-only';

const ROOT = path.join(process.cwd(), 'local_data');
const BACKUP_DIR = path.join(ROOT, 'backups');

function ensureDir(p: string){ if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export async function listBackups(): Promise<BackupMeta[]> {
  ensureDir(BACKUP_DIR);
  const metas: BackupMeta[] = [];
  const files = await fsp.readdir(BACKUP_DIR).catch(()=>[] as string[]);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const j = JSON.parse(await fsp.readFile(path.join(BACKUP_DIR, f), 'utf8')) as BackupMeta;
      metas.push(j);
    } catch {}
  }
  metas.sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
  return metas;
}

function safeSlug(s: string){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40); }

export async function createBackup(note?: string, scope: BackupScope = 'data'): Promise<BackupMeta> {
  ensureDir(BACKUP_DIR);
  const now = new Date().toISOString();
  const latestList = await store.listRuns(1);
  const latest = latestList && latestList.length ? (latestList[0] as { id: string; title?: string }) : undefined;
  let title = latest?.title || 'auto backup';
  if (!title && latest?.id) title = `run ${latest.id}`;
  const id = `${now.replace(/[:.]/g,'-')}-${safeSlug(title || 'nofx') || 'nofx'}`;
  const kind: 'fs'|'db' = (store.driver === 'db') ? 'db' : 'fs';
  const metaPath = path.join(BACKUP_DIR, `${id}.json`);
  const tarPath = path.join(BACKUP_DIR, `${id}.tar.gz`);

  const tmp = path.join(BACKUP_DIR, `.tmp-${id}`);
  ensureDir(tmp);
  if (kind === 'fs') {
    // stage NOFX data
    if (scope !== 'project-only') {
      const dataDst = path.join(tmp, 'nofx_data');
      await copyDir(ROOT, dataDst, ['backups']);
    }
  } else {
    // stage DB export
    if (scope !== 'project-only') {
      const dump: Record<string, unknown> = {};
      try {
        const tables = ['nofx.run','nofx.step','nofx.event','nofx.gate','nofx.artifact','nofx.settings','nofx.model'];
        for (const t of tables) {
          try {
            const rows = await query<Record<string, unknown>>(`select * from ${t}`);
            dump[t] = rows.rows;
          } catch {}
        }
        await fsp.writeFile(path.join(tmp, 'db.json'), JSON.stringify(dump, null, 2));
      } catch {}
    }
  }
  // optionally include the project working tree
  if (scope === 'with-project' || scope === 'project-only') {
    const projDst = path.join(tmp, 'project');
    await copyDir(process.cwd(), projDst, ['node_modules','[.]git','local_data/backups','coverage','test-results','trash']);
  }
  // tar the staged tmp
  const res = spawnSync('tar', ['-czf', tarPath, '-C', tmp, '.']);
  if (res.status !== 0) throw new Error('tar failed');
  try { await fsp.rm(tmp, { recursive: true, force: true }); } catch {}
  const stat = await fsp.stat(tarPath).catch(()=>({ size: 0 } as fs.Stats));
  const meta: BackupMeta = { id, created_at: now, title, note, size_bytes: stat.size, kind, scope };

  // Try cloud upload to Supabase Storage if configured
  try {
    const u8 = await fsp.readFile(tarPath);
    const key = `backups/${path.basename(tarPath)}`;
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).upload(key, u8 as any, { upsert: true } as any);
    meta.cloud = error ? { uploaded: false, error: error.message } : { uploaded: true, path: key };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    meta.cloud = { uploaded: false, error: msg };
  }

  await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2));
  return meta;
}

export async function restoreBackup(id: string): Promise<BackupMeta> {
  ensureDir(BACKUP_DIR);
  const metaPath = path.join(BACKUP_DIR, `${id}.json`);
  const tarPath = path.join(BACKUP_DIR, `${id}.tar.gz`);
  const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8')) as BackupMeta;
  if (!fs.existsSync(tarPath)) throw new Error('snapshot missing tar');
  // Always snapshot current state before restore
  await createBackup(`auto-pre-restore:${id}`);
  const tmp = path.join(BACKUP_DIR, `.restore-${id}`);
  ensureDir(tmp);
  const ext = spawnSync('tar', ['-xzf', tarPath, '-C', tmp]);
  if (ext.status !== 0) throw new Error('restore extract failed');
  if (meta.kind === 'fs') {
    // Restore local_data from staged nofx_data if present
    const staged = path.join(tmp, 'nofx_data');
    if (fs.existsSync(staged)) {
      await copyDir(staged, ROOT, []);
    }
    try { await fsp.rm(tmp, { recursive: true, force: true }); } catch {}
    return meta;
  }
  // DB restore: read db.json and import
  const dbFile = path.join(tmp, 'db.json');
  if (!fs.existsSync(dbFile)) throw new Error('db.json not found in snapshot');
  const dump = JSON.parse(await fsp.readFile(dbFile, 'utf8')) as Record<string, Record<string, unknown>[]>;
  await restoreDbFromJson(dump);
  try { await fsp.rm(tmp, { recursive: true, force: true }); } catch {}
  return meta;
}

async function restoreDbFromJson(dump: Record<string, Record<string, unknown>[]>) {
  // Order matters due to FKs; delete children first
  const delOrder = ['nofx.artifact','nofx.event','nofx.gate','nofx.step','nofx.run','nofx.model','nofx.settings'];
  const insOrder = ['nofx.settings','nofx.model','nofx.run','nofx.step','nofx.artifact','nofx.event','nofx.gate'];
  await query('begin');
  try {
    for (const t of delOrder) { try { await query(`delete from ${t}`); } catch {} }
    for (const t of insOrder) {
      const rows = dump[t] || [];
      if (!rows.length) continue;
      // Build dynamic insert
      const firstRow = rows[0];
      if (!firstRow) continue;
      const cols = Object.keys(firstRow);
      const placeholders: string[] = [];
      const values: unknown[] = [];
      const chunk = 100;
      for (let i=0;i<rows.length;i+=chunk){
        const part = rows.slice(i, i+chunk);
        placeholders.length = 0; values.length = 0;
        part.forEach((r, idx) => {
          const ps = cols.map((_, cidx) => `$${idx*cols.length + cidx + 1}`);
          placeholders.push(`(${ps.join(',')})`);
          values.push(...cols.map(k => r[k]));
        });
        const sql = `insert into ${t} (${cols.map(c=>`"${c}"`).join(',')}) values ${placeholders.join(',')}`;
        await query(sql, values).catch(()=>{});
      }
    }
    await query('commit');
  } catch (e) {
    await query('rollback').catch(()=>{});
    throw e;
  }
}

async function copyDir(src: string, dst: string, exclude: string[], baseRel = '') {
  ensureDir(dst);
  let ents: fs.Dirent[] = [];
  try { ents = await fsp.readdir(src, { withFileTypes: true }) as unknown as fs.Dirent[]; }
  catch { return; }
  for (const ent of ents) {
    const name = ent.name;
    const rel = baseRel ? path.join(baseRel, name) : name;
    // Exclude by relative path segment or regex pattern
    if (exclude.some(p => new RegExp(p).test(rel) || p === name)) continue;
    const s = path.join(src, name);
    const d = path.join(dst, name);
    try {
      if (ent.isDirectory()) {
        await copyDir(s, d, exclude, rel);
      } else if (ent.isFile()) {
        await fsp.mkdir(path.dirname(d), { recursive: true });
        await fsp.copyFile(s, d);
      } else {
        // skip symlinks and other types for portability
      }
    } catch {
      // skip problematic entries instead of failing the whole backup
    }
  }
}
