/**
 * File Operation Service - extracted from FileSystemStore.ts
 * Handles core file system operations
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { JsonValue } from '../types';

export class FileOperationService {
  /**
   * Ensure directory exists, create if needed
   */
  ensureDirSync(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Write JSON data to file
   */
  async writeJsonFile(filePath: string, data: JsonValue): Promise<void> {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Read and parse JSON file
   */
  async readJsonFile(filePath: string): Promise<JsonValue | null> {
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      try {
        return JSON.parse(content);
      } catch {
        // Malformed JSON - return null to indicate invalid data
        return null;
      }
    } catch {
      // File not found or read error - return null
      return null;
    }
  }

  /**
   * Read directory contents safely
   */
  async readDirectorySafe(dirPath: string): Promise<string[]> {
    try {
      return await fsp.readdir(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Check if file exists
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Get file path for run
   */
  getRunPath(runId: string, root: string): string {
    return path.join(root, 'runs', runId, 'run.json');
  }

  /**
   * Get directory path for run
   */
  getRunDirectory(runId: string, root: string): string {
    return path.join(root, 'runs', runId);
  }

  /**
   * Get file path for step
   */
  getStepPath(runId: string, stepId: string, root: string): string {
    return path.join(root, 'runs', runId, 'steps', `${stepId}.json`);
  }

  /**
   * Get directory path for steps
   */
  getStepsDirectory(runId: string, root: string): string {
    return path.join(root, 'runs', runId, 'steps');
  }

  /**
   * Get file path for event
   */
  getEventPath(runId: string, eventId: string, root: string): string {
    return path.join(root, 'runs', runId, 'events', `${eventId}.json`);
  }

  /**
   * Get directory path for events
   */
  getEventsDirectory(runId: string, root: string): string {
    return path.join(root, 'runs', runId, 'events');
  }

  /**
   * Get file path for artifact
   */
  getArtifactPath(runId: string, artifactId: string, root: string): string {
    return path.join(root, 'runs', runId, 'artifacts', `${artifactId}.json`);
  }

  /**
   * Get runs index path
   */
  getRunsIndexPath(root: string): string {
    return path.join(root, 'runs', 'index.json');
  }
}