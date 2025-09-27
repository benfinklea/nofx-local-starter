/**
 * Export Service - extracted from archiveStore.ts
 * Handles run export and cold storage operations
 */

import fs from 'node:fs';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import type { TimelineSnapshot } from '../../../shared/responses/archive';
import { FileManagerService } from './FileManagerService';
import { SerializationService } from './SerializationService';

export class ExportService {
  private readonly exportDir: string;
  private readonly coldStorageDir?: string;

  constructor(
    private readonly fileManager: FileManagerService,
    private readonly serialization: SerializationService,
    baseDir: string,
    options?: { coldStorageDir?: string; exportDir?: string }
  ) {
    this.coldStorageDir = options?.coldStorageDir;
    this.exportDir = options?.exportDir ?? path.join(baseDir, '..', 'exports');
  }

  async exportRun(timeline: TimelineSnapshot, runId: string): Promise<string> {
    this.fileManager.ensureDir(this.exportDir);
    const dest = path.join(this.exportDir, `${runId}.json.gz`);
    const tmp = path.join(this.exportDir, `${runId}.${Date.now()}.json`);
    await fsPromises.writeFile(tmp, JSON.stringify({
      run: this.serialization.serializeRun(timeline.run),
      events: timeline.events.map((event) => this.serialization.serializeEvent(event)),
    }, null, 2));
    await pipeline(fs.createReadStream(tmp), zlib.createGzip(), fs.createWriteStream(dest));
    await fsPromises.rm(tmp);
    return dest;
  }

  moveToColdStorage(runId: string): void {
    if (!this.coldStorageDir) return;
    const sourceDir = this.fileManager.runDir(runId);
    if (!this.fileManager.fileExists(sourceDir)) return;
    const destinationRoot = path.resolve(this.coldStorageDir);
    this.fileManager.ensureDir(destinationRoot);
    const destination = path.join(destinationRoot, runId);
    this.fileManager.copyDirectory(sourceDir, destination);
    this.fileManager.deleteDirectory(sourceDir);
  }
}