import type { Express } from 'express';
import { z } from 'zod';
import { isAdmin } from '../../lib/auth';
import { listProjects, getProject, createProject, updateProject, deleteProject } from '../../lib/projects';
import type { Project } from '../../lib/projects';

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  repo_url: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  local_path: z.string().optional(),
  workspace_mode: z.enum(['local_path','clone','worktree']).optional(),
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

export default function mount(app: Express){
  app.get('/projects', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    const rows = await listProjects();
    res.json({ projects: rows });
  });
  app.post('/projects', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    const parsed = UpsertSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = await createProject(normalizeProjectInput(parsed.data));
    res.status(201).json(row);
  });
  app.get('/projects/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    const row = await getProject(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });
  app.patch('/projects/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    const parsed = UpsertSchema.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const row = await updateProject(req.params.id, normalizeProjectInput(parsed.data));
    res.json(row);
  });
  app.delete('/projects/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    await deleteProject(req.params.id);
    res.json({ ok: true });
  });
}
