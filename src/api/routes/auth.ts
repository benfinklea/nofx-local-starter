import type { Express } from 'express';
import { isAdmin, issueAdminCookie } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/ui/login', (req, res) => {
    if (isAdmin(req)) return res.redirect('/ui/runs');
    res.render('login');
  });
  app.post('/login', (req, res) => {
    const pwd = (req.body && (req.body.password || req.body.pwd)) || '';
    const expected = process.env.ADMIN_PASSWORD || 'admin';
    if (pwd !== expected) return res.status(401).render('login', { error: 'Invalid password' });
    res.setHeader('Set-Cookie', issueAdminCookie());
    const next = (req.query.next as string) || '/ui/runs';
    res.redirect(next);
  });
  app.post('/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'nofx_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    res.redirect('/ui/login');
  });
}

