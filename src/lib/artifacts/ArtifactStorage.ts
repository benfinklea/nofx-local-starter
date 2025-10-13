/**
 * ArtifactStorage - Two-stage artifact handling system
 *
 * Stage 1: Artifact Generation - Save to local_data/runs/{runId}/steps/{stepId}/
 * Stage 2: Workspace Writing - Optional copy to project workspace (handled by workspace_write handler)
 *
 * Supports both filesystem (development) and Supabase (production) storage.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '../logger';
import { store } from '../store';

export interface Artifact {
  id: string;
  run_id: string;
  step_id: string;
  path: string;
  type: string;
  metadata: {
    size: number;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface ArtifactWithContent {
  content: Buffer;
  metadata: Artifact;
}

/**
 * ArtifactStorage service for managing generated artifacts
 */
export class ArtifactStorage {
  private supabaseClient?: SupabaseClient;
  private driverType: 'filesystem' | 'supabase';

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.driverType = this.selectDriver();
  }

  /**
   * Select storage driver based on environment configuration
   */
  private selectDriver(): 'filesystem' | 'supabase' {
    const dataDriver = process.env.DATA_DRIVER || 'fs';

    if (dataDriver === 'postgres' && this.supabaseClient) {
      return 'supabase';
    }

    if (dataDriver !== 'fs' && dataDriver !== 'postgres') {
      throw new Error(`Invalid DATA_DRIVER: ${dataDriver}. Must be 'fs' or 'postgres'`);
    }

    return 'filesystem';
  }

  /**
   * Get the current storage driver type
   */
  public getDriverType(): 'filesystem' | 'supabase' {
    return this.driverType;
  }

  /**
   * Validate and sanitize IDs to prevent path traversal
   */
  private validateId(id: string, name: string): void {
    if (!id) {
      throw new Error(`${name} is required`);
    }

    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw new Error(`Invalid ${name}: contains invalid characters`);
    }

    // Allow only alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid ${name}: must contain only alphanumeric, underscore, or hyphen characters`);
    }
  }

  /**
   * Validate and sanitize filename to prevent path traversal
   */
  private validateFilename(filename: string): void {
    if (!filename || filename.trim() === '') {
      throw new Error('Filename is required');
    }

    if (filename.includes('\x00')) {
      throw new Error('Invalid filename: contains null byte');
    }

    if (path.isAbsolute(filename)) {
      throw new Error('Invalid filename: absolute paths not allowed');
    }

    if (filename.includes('..')) {
      throw new Error('Invalid filename: path traversal not allowed');
    }
  }

  /**
   * Validate content is not empty
   */
  private validateContent(content: string | Buffer): void {
    if (!content || (typeof content === 'string' && content.trim() === '')) {
      throw new Error('Content is required and cannot be empty');
    }
  }

  /**
   * Get filesystem path for artifact
   */
  private getFilesystemPath(runId: string, stepId: string, filename: string): string {
    const baseDir = path.join(process.cwd(), 'local_data', 'runs', runId, 'steps', stepId);
    return path.join(baseDir, filename);
  }

  /**
   * Get Supabase storage path for artifact
   */
  private getSupabasePath(runId: string, stepId: string, filename: string): string {
    return `runs/${runId}/steps/${stepId}/${filename}`;
  }

  /**
   * Save artifact to storage
   */
  public async saveArtifact(
    runId: string,
    stepId: string,
    filename: string,
    content: string | Buffer,
    mimeType?: string
  ): Promise<Artifact> {
    // Validation
    this.validateId(runId, 'runId');
    this.validateId(stepId, 'stepId');
    this.validateFilename(filename);
    this.validateContent(content);

    const type = mimeType || 'application/octet-stream';
    const size = Buffer.byteLength(content);

    log.info({ runId, stepId, filename, size, type }, 'Saving artifact');

    try {
      let storagePath: string;

      if (this.driverType === 'filesystem') {
        storagePath = await this.saveToFilesystem(runId, stepId, filename, content);
      } else {
        storagePath = await this.saveToSupabase(runId, stepId, filename, content, type);
      }

      // Store metadata in database
      const artifact = await store.createArtifact({
        run_id: runId,
        step_id: stepId,
        path: storagePath,
        type,
        metadata: {
          size,
        },
      });

      log.info({ artifactId: artifact.id, storagePath }, 'Artifact saved successfully');
      return artifact;
    } catch (error) {
      // Attempt cleanup on failure
      try {
        if (this.driverType === 'filesystem') {
          const filePath = this.getFilesystemPath(runId, stepId, filename);
          await fs.unlink(filePath).catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }

      log.error({ error, runId, stepId, filename }, 'Failed to save artifact');
      throw error;
    }
  }

  /**
   * Save artifact to filesystem
   */
  private async saveToFilesystem(
    runId: string,
    stepId: string,
    filename: string,
    content: string | Buffer
  ): Promise<string> {
    const filePath = this.getFilesystemPath(runId, stepId, filename);
    const dir = path.dirname(filePath);

    // Create directory structure
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');

    // Return relative path
    return path.relative(process.cwd(), filePath);
  }

  /**
   * Save artifact to Supabase storage
   */
  private async saveToSupabase(
    runId: string,
    stepId: string,
    filename: string,
    content: string | Buffer,
    mimeType: string
  ): Promise<string> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const storagePath = this.getSupabasePath(runId, stepId, filename);
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    const { error } = await this.supabaseClient.storage
      .from('artifacts')
      .upload(storagePath, contentBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return storagePath;
  }

  /**
   * Get artifact content and metadata
   */
  public async getArtifact(
    runId: string,
    stepId: string,
    filename: string
  ): Promise<ArtifactWithContent | null> {
    this.validateId(runId, 'runId');
    this.validateId(stepId, 'stepId');
    this.validateFilename(filename);

    log.info({ runId, stepId, filename }, 'Retrieving artifact');

    // Get metadata from database
    const artifact = await store.getArtifact(runId, stepId, filename);
    if (!artifact) {
      log.warn({ runId, stepId, filename }, 'Artifact not found in database');
      return null;
    }

    try {
      let content: Buffer;

      if (this.driverType === 'filesystem') {
        const filePath = path.join(process.cwd(), artifact.path);
        content = await fs.readFile(filePath);
      } else {
        content = await this.downloadFromSupabase(artifact.path);
      }

      return { content, metadata: artifact };
    } catch (error) {
      log.error({ error, runId, stepId, filename }, 'Failed to retrieve artifact content');
      throw error;
    }
  }

  /**
   * Download artifact from Supabase storage
   */
  private async downloadFromSupabase(storagePath: string): Promise<Buffer> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await this.supabaseClient.storage
      .from('artifacts')
      .download(storagePath);

    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * List artifacts for a run or step
   */
  public async listArtifacts(runId: string, stepId?: string): Promise<Artifact[]> {
    this.validateId(runId, 'runId');
    if (stepId) {
      this.validateId(stepId, 'stepId');
    }

    log.info({ runId, stepId }, 'Listing artifacts');

    if (stepId) {
      return await store.listArtifactsByStep(runId, stepId);
    } else {
      return await store.listArtifactsByRun(runId);
    }
  }

  /**
   * Check if artifact exists
   */
  public async artifactExists(
    runId: string,
    stepId: string,
    filename: string
  ): Promise<boolean> {
    try {
      const artifact = await store.getArtifact(runId, stepId, filename);
      return artifact !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete a single artifact
   */
  public async deleteArtifact(
    runId: string,
    stepId: string,
    filename: string
  ): Promise<void> {
    this.validateId(runId, 'runId');
    this.validateId(stepId, 'stepId');
    this.validateFilename(filename);

    log.info({ runId, stepId, filename }, 'Deleting artifact');

    const artifact = await store.getArtifact(runId, stepId, filename);
    if (!artifact) {
      log.warn({ runId, stepId, filename }, 'Artifact not found, skipping deletion');
      return;
    }

    try {
      // Delete from storage
      if (this.driverType === 'filesystem') {
        const filePath = path.join(process.cwd(), artifact.path);
        await fs.unlink(filePath).catch(() => {});
      } else {
        await this.deleteFromSupabase(artifact.path);
      }

      // Delete from database
      await store.deleteArtifact(runId, stepId, filename);

      log.info({ runId, stepId, filename }, 'Artifact deleted successfully');
    } catch (error) {
      log.error({ error, runId, stepId, filename }, 'Failed to delete artifact');
      throw error;
    }
  }

  /**
   * Delete artifact from Supabase storage
   */
  private async deleteFromSupabase(storagePath: string): Promise<void> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const { error } = await this.supabaseClient.storage
      .from('artifacts')
      .remove([storagePath]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  /**
   * Delete all artifacts for a run
   */
  public async deleteArtifactsByRun(runId: string): Promise<void> {
    this.validateId(runId, 'runId');

    log.info({ runId }, 'Deleting all artifacts for run');

    try {
      // Delete from storage
      if (this.driverType === 'filesystem') {
        const runDir = path.join(process.cwd(), 'local_data', 'runs', runId);
        await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
      } else {
        log.warn({ runId }, 'Supabase bulk deletion not implemented, skipping storage cleanup');
      }

      // Delete from database
      await store.deleteArtifactsByRun?.(runId);

      log.info({ runId }, 'Run artifacts deleted successfully');
    } catch (error) {
      log.error({ error, runId }, 'Failed to delete run artifacts');
      throw error;
    }
  }

  /**
   * Delete all artifacts for a step
   */
  public async deleteArtifactsByStep(runId: string, stepId: string): Promise<void> {
    this.validateId(runId, 'runId');
    this.validateId(stepId, 'stepId');

    log.info({ runId, stepId }, 'Deleting all artifacts for step');

    try {
      // Delete from storage
      if (this.driverType === 'filesystem') {
        const stepDir = path.join(process.cwd(), 'local_data', 'runs', runId, 'steps', stepId);
        await fs.rm(stepDir, { recursive: true, force: true }).catch(() => {});
      } else {
        log.warn({ runId, stepId }, 'Supabase bulk deletion not implemented, skipping storage cleanup');
      }

      // Delete from database
      await store.deleteArtifactsByStep?.(runId, stepId);

      log.info({ runId, stepId }, 'Step artifacts deleted successfully');
    } catch (error) {
      log.error({ error, runId, stepId }, 'Failed to delete step artifacts');
      throw error;
    }
  }
}

// Export singleton instance
export const artifactStorage = new ArtifactStorage();
