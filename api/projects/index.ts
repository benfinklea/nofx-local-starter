import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { listProjects, createProject } from '../../src/lib/projects';
import type { Project } from '../../src/lib/projects';
import { withCors } from '../_lib/cors';

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  repo_url: z.string().url('GitHub repository URL is required'),
  workspace_mode: z.enum(['clone', 'worktree']).optional().default('clone'),
  default_branch: z.string().optional()
});

type UpsertInput = z.infer<typeof UpsertSchema>;

function normalizeProjectInput(input: Partial<UpsertInput>): Partial<Project> {
  const result: Partial<Project> = {};
  if (input.id !== undefined) result.id = input.id;
  if (input.name !== undefined) result.name = input.name;
  if (input.repo_url !== undefined) result.repo_url = input.repo_url;
  result.local_path = null; // GitHub-only: no local paths
  if (input.workspace_mode !== undefined) result.workspace_mode = input.workspace_mode;
  if (input.default_branch !== undefined) result.default_branch = input.default_branch ?? null;
  return result;
}

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication (skip in development if no auth is configured)
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    // List all projects
    try {
      const rows = await listProjects();
      return res.json({ projects: rows });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to list projects';
      return res.status(500).json({ error: message });
    }
  } else if (req.method === 'POST') {
    // Create a new project
    try {
      const parsed = UpsertSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const row = await createProject(normalizeProjectInput(parsed.data));
      return res.status(201).json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create project';
      return res.status(500).json({ error: message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
});
