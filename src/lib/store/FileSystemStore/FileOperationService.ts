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
   * Validate that resolved path is within the expected directory
   * Throws error if path traversal is detected
   */
  private validatePath(resolvedPath: string, expectedParent: string): void {
    // Resolve both paths to absolute paths to detect escaping
    const resolvedAbsolute = path.resolve(resolvedPath);
    const parentAbsolute = path.resolve(expectedParent);

    // Check if the resolved path starts with the expected parent
    if (!resolvedAbsolute.startsWith(parentAbsolute)) {
      throw new Error('Path traversal detected');
    }

    // Additional check: ensure no '..' remains after resolution
    const normalized = path.normalize(resolvedPath);
    if (normalized.includes('..')) {
      throw new Error('Path traversal detected');
    }
  }

  /**
   * Ensure directory exists, create if needed
   */
  ensureDirSync(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Write JSON data to file with formatting
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
   * Get file path for run (with path traversal validation)
   */
  getRunPath(runId: string, root: string): string {
    const filePath = path.join(root, 'runs', runId, 'run.json');
    this.validatePath(filePath, root);
    return filePath;
  }

  /**
   * Get directory path for run (with path traversal validation)
   */
  getRunDirectory(runId: string, root: string): string {
    const dirPath = path.join(root, 'runs', runId);
    this.validatePath(dirPath, path.join(root, 'runs'));
    return dirPath;
  }

  /**
   * Get file path for step (with path traversal validation)
   */
  getStepPath(runId: string, stepId: string, root: string): string {
    const runDir = path.join(root, 'runs', runId);
    const filePath = path.join(runDir, 'steps', `${stepId}.json`);
    this.validatePath(filePath, runDir);
    return filePath;
  }

  /**
   * Get directory path for steps (with path traversal validation)
   */
  getStepsDirectory(runId: string, root: string): string {
    const dirPath = path.join(root, 'runs', runId, 'steps');
    this.validatePath(dirPath, root);
    return dirPath;
  }

  /**
   * Get file path for event (with path traversal validation)
   */
  getEventPath(runId: string, eventId: string, root: string): string {
    const eventsDir = path.join(root, 'runs', runId, 'events');
    const filePath = path.join(eventsDir, `${eventId}.json`);
    this.validatePath(filePath, eventsDir);
    return filePath;
  }

  /**
   * Get directory path for events (with path traversal validation)
   */
  getEventsDirectory(runId: string, root: string): string {
    const dirPath = path.join(root, 'runs', runId, 'events');
    this.validatePath(dirPath, root);
    return dirPath;
  }

  /**
   * Get file path for artifact (with path traversal validation)
   */
  getArtifactPath(runId: string, artifactId: string, root: string): string {
    const artifactsDir = path.join(root, 'runs', runId, 'artifacts');
    const filePath = path.join(artifactsDir, `${artifactId}.json`);
    this.validatePath(filePath, artifactsDir);
    return filePath;
  }

  /**
   * Get runs index path
   */
  getRunsIndexPath(root: string): string {
    return path.join(root, 'runs', 'index.json');
  }
}