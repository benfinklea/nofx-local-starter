import type { Express } from 'express';
import { isAdmin } from '../../lib/auth';
import { listProjects, getProject } from '../../lib/projects';

export default function mount(app: Express) {
  // Projects management UI
  app.get('/ui/projects', async (req, res): Promise<void> => {
    if (!isAdmin(req)) {
      return res.redirect('/ui/login');
    }

    try {
      const projects = await listProjects();
      return res.render('projects', { projects });
    } catch (error) {
      return res.status(500).render('error', {
        error: 'Failed to load projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Individual project settings
  app.get('/ui/projects/:id', async (req, res): Promise<void> => {
    if (!isAdmin(req)) {
      return res.redirect('/ui/login');
    }

    try {
      const project = await getProject(req.params.id);
      if (!project) {
        return res.status(404).render('error', {
          error: 'Project not found'
        });
      }

      return res.render('project_settings', { project });
    } catch (error) {
      return res.status(500).render('error', {
        error: 'Failed to load project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
