import type { Express } from 'express';
import { isAdmin } from '../../lib/auth';
import { listProjects, getProject } from '../../lib/projects';

export default function mount(app: Express) {
  // Projects management UI
  app.get('/ui/projects', async (req, res) => {
    if (!isAdmin(req)) {
      return res.redirect('/ui/login');
    }

    try {
      const projects = await listProjects();
      res.render('projects', { projects });
    } catch (error) {
      res.status(500).render('error', {
        error: 'Failed to load projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Individual project settings
  app.get('/ui/projects/:id', async (req, res) => {
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

      res.render('project_settings', { project });
    } catch (error) {
      res.status(500).render('error', {
        error: 'Failed to load project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}