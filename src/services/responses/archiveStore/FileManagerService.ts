/**
 * File Manager Service - extracted from archiveStore.ts
 * Handles file operations and directory management
 */

import fs from 'node:fs';
import path from 'node:path';

export class FileManagerService {
  constructor(private readonly baseDir: string) {}

  ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  readJSON<T>(file: string, fallback: T): T {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
      throw err;
    }
  }

  writeJSON(file: string, value: unknown): void {
    this.ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  }

  runDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  runFile(runId: string): string {
    return path.join(this.runDir(runId), 'run.json');
  }

  eventsFile(runId: string): string {
    return path.join(this.runDir(runId), 'events.json');
  }

  fileExists(file: string): boolean {
    return fs.existsSync(file);
  }

  deleteDirectory(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  listDirectories(): string[] {
    if (!fs.existsSync(this.baseDir)) return [];
    return fs.readdirSync(this.baseDir);
  }

  copyDirectory(source: string, destination: string): void {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
}