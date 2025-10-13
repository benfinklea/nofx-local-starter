/**
 * Project management routes with standardized API responses
 */
import type { Express } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware';
import { ApiResponse } from '../../lib/apiResponse';
import { createApiError } from '../../lib/errors';
import { listProjects, getProject, createProject, updateProject, deleteProject } from '../../lib/projects';
import type { Project } from '../../lib/projects';

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  repo_url: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  local_path: z.string().optional(),
  workspace_mode: z.enum(['local_path','clone','worktree']).optional(),
  default_branch: z.string().optional(),
  git_mode: z.enum(['hidden','basic','advanced']).optional(),
  initialized: z.boolean().optional()
});

type UpsertInput = z.infer<typeof UpsertSchema>;

function normalizeProjectInput(input: Partial<UpsertInput>): Partial<Project> {
  const result: Partial<Project> = {};
  if (input.id !== undefined) result.id = input.id;
  if (input.name !== undefined) result.name = input.name;
  if (input.repo_url !== undefined) result.repo_url = input.repo_url ?? null;
  if (input.local_path !== undefined) result.local_path = input.local_path ?? null;
  if (input.workspace_mode !== undefined) result.workspace_mode = input.workspace_mode;
  if (input.default_branch !== undefined) result.default_branch = input.default_branch ?? null;
  if (input.git_mode !== undefined) result.git_mode = input.git_mode;
  if (input.initialized !== undefined) result.initialized = input.initialized;
  return result;
}

/**
 * Mount project management routes
 *
 * @param app - Express application instance
 */
export default function mount(app: Express){
  /**
   * List all projects
   */
  app.get('/projects', requireAuth, async (_req, res): Promise<void> => {
    try {
      const rows = await listProjects();
      ApiResponse.success(res, { projects: rows });
    } catch (error) {
      const apiError = createApiError.internal('Failed to list projects', error);
      ApiResponse.fromApiError(res, apiError);
    }
  });

  /**
   * Create a new project
   */
  app.post('/projects', requireAuth, async (req, res): Promise<void> => {
    try {
      const parsed = UpsertSchema.safeParse(req.body || {});
      if (!parsed.success) {
        const errors = parsed.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        const apiError = createApiError.validationMultiple('Invalid project data', errors);
        ApiResponse.fromApiError(res, apiError);
        return;
      }
      const row = await createProject(normalizeProjectInput(parsed.data));
      ApiResponse.success(res, row, 201);
    } catch (error) {
      const apiError = createApiError.internal('Failed to create project', error);
      ApiResponse.fromApiError(res, apiError);
    }
  });

  /**
   * Get a specific project by ID
   */
  app.get('/projects/:id', requireAuth, async (req, res): Promise<void> => {
    try {
      const id = req.params.id || '';
      const row = await getProject(id);
      if (!row) {
        const apiError = createApiError.notFound('Project', id);
        ApiResponse.fromApiError(res, apiError);
        return;
      }
      ApiResponse.success(res, row);
    } catch (error) {
      const id = req.params.id || '';
      const apiError = createApiError.internal('Failed to get project', error, { projectId: id });
      ApiResponse.fromApiError(res, apiError);
    }
  });

  /**
   * Update a project
   */
  app.patch('/projects/:id', requireAuth, async (req, res): Promise<void> => {
    try {
      const parsed = UpsertSchema.partial().safeParse(req.body || {});
      if (!parsed.success) {
        const errors = parsed.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        const apiError = createApiError.validationMultiple('Invalid project data', errors);
        ApiResponse.fromApiError(res, apiError);
        return;
      }
      const id = req.params.id || '';
      const row = await updateProject(id, normalizeProjectInput(parsed.data));
      ApiResponse.success(res, row);
    } catch (error) {
      const id = req.params.id || '';
      const apiError = createApiError.internal('Failed to update project', error, { projectId: id });
      ApiResponse.fromApiError(res, apiError);
    }
  });

  /**
   * Delete a project
   */
  app.delete('/projects/:id', requireAuth, async (req, res): Promise<void> => {
    try {
      const id = req.params.id || '';
      await deleteProject(id);
      ApiResponse.success(res, { message: 'Project deleted successfully' });
    } catch (error) {
      const id = req.params.id || '';
      const apiError = createApiError.internal('Failed to delete project', error, { projectId: id });
      ApiResponse.fromApiError(res, apiError);
    }
  });
}
