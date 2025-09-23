import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { supabase, ARTIFACT_BUCKET } from './supabase';
import crypto from 'node:crypto';
import { store, type JsonValue } from './store';
import { log } from './logger';

function ensureDirSync(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export async function saveArtifact(runId: string, stepId: string, artifactName: string, content: string, contentType='text/plain') {
  const rel = `runs/${runId}/steps/${stepId}/${artifactName}`;
  const full = path.join(process.cwd(), 'local_data', rel);

  const writeLocal = async (metadata: Record<string, JsonValue>) => {
    ensureDirSync(path.dirname(full));
    await fsp.writeFile(full, content, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const driver = typeof metadata.driver === 'string' ? metadata.driver : 'fs';
    const enriched: Record<string, JsonValue> = { ...metadata, driver, sha256 };
    await store.addArtifact(stepId, contentType, rel, enriched);
    return rel;
  };

  if (store.driver === 'fs') {
    return writeLocal({});
  }

  const storage = supabase?.storage;
  try {
    if (!storage || typeof storage.from !== 'function') {
      throw new Error('supabase storage client unavailable');
    }
    const bucket = storage.from(ARTIFACT_BUCKET);
    if (!bucket || typeof bucket.upload !== 'function') {
      throw new Error('supabase storage bucket upload unavailable');
    }
    const body = Buffer.from(content, 'utf8');
    const { error } = await bucket.upload(rel, body, { upsert: true, contentType });
    if (error) throw error;
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    await store.addArtifact(stepId, contentType, rel, { driver: 'supabase', sha256 });
    return rel;
  } catch (err) {
    log.warn({ runId, stepId, err }, 'artifact.supabase.fallback');
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ runId, stepId, error: message }, 'artifact.supabase.fallback');
    return writeLocal({ driver: 'fs-fallback', fallback: 'supabase', error: message });
  }
}
