import type { Express } from 'express';
import { issueAdminCookie } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/ui/login', (req, res): void => {
    // Redirect to new login page
    const next = (req.query.next as string) || '/ui/app/#/runs';
    res.redirect(`/api/login?next=${encodeURIComponent(next)}`);
  });
  app.post('/login', (req, res): void => {
    const pwd = (req.body && (req.body.password || req.body.pwd)) || '';
    const expected = process.env.ADMIN_PASSWORD || 'admin';
    if (pwd !== expected) { res.status(401).render('login', { error: 'Invalid password' }); return; }
    res.setHeader('Set-Cookie', issueAdminCookie());
    const next = (req.query.next as string) || '/ui/app/#/runs';
    res.redirect(next);
  });
  app.post('/logout', (_req, res): void => {
    res.setHeader('Set-Cookie', 'nofx_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    res.redirect('/ui/login');
  });
  app.get('/logout', (_req, res): void => {
    res.setHeader('Set-Cookie', 'nofx_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    res.redirect('/ui/login');
  });

  // Dev-only auto login helper (no password). Useful for FE proxy on :5173.
  app.get('/dev/login', (req, res): void => {
    // In production, redirect to the new login page
    if (process.env.NODE_ENV === 'production') {
      const next = (req.query.next as string) || '/ui/app/#/runs';
      res.redirect(`/api/login?next=${encodeURIComponent(next)}`);
      return;
    }
    res.setHeader('Set-Cookie', issueAdminCookie());
    const next = (req.query.next as string) || '/ui/app/#/runs';
    res.redirect(next);
  });
}
