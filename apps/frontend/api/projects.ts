import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { withAuth } from './auth-middleware';
import { listProjects, createProject } from '../../../src/lib/projects';
import type { Project } from '../../../src/lib/projects';

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  repo_url: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  local_path: z.string().optional(),
  workspace_mode: z.enum(['local_path', 'clone', 'worktree']).optional(),
  default_branch: z.string().optional()
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
  return result;
}

async function handler(req: VercelRequest, res: VercelResponse, user: any) {
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

      const input = normalizeProjectInput(parsed.data);
      const created = await createProject(input);

      return res.json(created);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create project';
      return res.status(500).json({ error: message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with auth middleware
export default withAuth(handler);