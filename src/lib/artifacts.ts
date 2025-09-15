import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { supabase, ARTIFACT_BUCKET } from './supabase';
import { store } from './store';

function ensureDirSync(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export async function saveArtifact(runId: string, stepId: string, artifactName: string, content: string, contentType='text/plain') {
  if (store.driver === 'fs') {
    const rel = path.join('runs', runId, 'steps', stepId, artifactName);
    const full = path.join(process.cwd(), 'local_data', rel);
    ensureDirSync(path.dirname(full));
    await fsp.writeFile(full, content, 'utf8');
    await store.addArtifact(stepId, contentType, rel, { driver: 'fs' });
    return rel;
  }
  // Supabase path
  const rel = `runs/${runId}/steps/${stepId}/${artifactName}`;
  const { error } = await supabase.storage.from(ARTIFACT_BUCKET).upload(rel, new Blob([content]), { upsert: true, contentType });
  if (error) throw error;
  await store.addArtifact(stepId, contentType, rel, { driver: 'supabase' });
  return rel;
}
