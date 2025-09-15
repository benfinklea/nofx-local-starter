import { createBackup } from './backup';
import { getSettings } from './settings';

let timer: ReturnType<typeof setInterval> | null = null;

export async function configureAutoBackup(min?: number){
  const minutes = Number(min||0);
  if (timer) { clearInterval(timer); timer = null; }
  if (minutes > 0) {
    timer = setInterval(() => { createBackup('auto-periodic').catch(() => {}); }, minutes * 60_000);
  }
}

export async function initAutoBackupFromSettings(){
  try {
    // If env var is provided, prefer it per workstream docs
    const envMin = Number(process.env.BACKUP_INTERVAL_MIN || 0);
    if (envMin > 0) {
      await configureAutoBackup(envMin);
      return;
    }
    const s = await getSettings();
    await configureAutoBackup(s.ops?.backupIntervalMin);
  } catch {}
}
