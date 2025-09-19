import type { Express } from 'express';
import { z } from 'zod';
import { isAdmin } from '../../lib/auth';
import { listProjects, getProject, createProject, updateProject, deleteProject } from '../../lib/projects';

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  repo_url: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
  local_path: z.string().optional(),
  workspace_mode: z.enum(['local_path','clone','worktree']).optional(),
  default_branch: z.string().optional()
});

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
    const row = await createProject(parsed.data as any);
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
    const row = await updateProject(req.params.id, parsed.data as any);
    res.json(row);
  });
  app.delete('/projects/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    await deleteProject(req.params.id);
    res.json({ ok: true });
  });
}

