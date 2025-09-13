# 20_UI — Minimal Web Console

**Depends on:** 00_BASE

## Files to add
- `src/ui/views/layout.ejs`
- `src/ui/views/runs.ejs`
- `src/ui/views/run.ejs`
- `src/ui/static/style.css`
- `src/api/routes/ui.ts`

### 1) Views
`src/ui/views/layout.ejs`
```html
<!doctype html><html><head>
<meta charset="utf-8"/><title>NOFX</title>
<link rel="stylesheet" href="/ui/static/style.css"/>
</head><body><%- body %></body></html>
```

`src/ui/views/runs.ejs`
```html
<%~ include('layout', { body: `
<h1>Runs</h1>
<ul>
${runs.map(r => `<li><a href="/ui/runs/${r.id}">${r.id}</a> — ${r.status}</li>`).join('')}
</ul>
`}) %>
```

`src/ui/views/run.ejs`
```html
<%~ include('layout', { body: `
<h1>Run ${run.id} — ${run.status}</h1>
<pre id="timeline"></pre>
<h2>Artifacts</h2>
<ul>
${artifacts.map(a => `<li>${a.step_name}: <a href="/ui/artifacts/signed?path=${encodeURIComponent(a.uri)}">download</a></li>`).join('')}
</ul>
<script>
async function load() {
  const rsp = await fetch('/runs/${run.id}/timeline'); const data = await rsp.json();
  document.getElementById('timeline').textContent = JSON.stringify(data,null,2);
}
load(); setInterval(load, 2000);
</script>
`}) %>
```

`src/ui/static/style.css`
```css
body{font-family:system-ui,Arial;padding:20px;line-height:1.4}
pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto}
```

### 2) Router
`src/api/routes/ui.ts`
```ts
import type { Express } from 'express';
import { query } from '../../lib/db';
import { supabase, ARTIFACT_BUCKET } from '../../lib/supabase';

export default function mount(app: Express){
  app.get('/ui/runs', async (_req, res) => {
    const rows = await query<any>(`select id,status,created_at from nofx.run order by created_at desc limit 100`);
    res.render('runs', { runs: rows.rows });
  });
  app.get('/ui/runs/:id', async (req, res) => {
    const runId = req.params.id;
    const run = await query<any>(`select * from nofx.run where id = $1`, [runId]);
    const artifacts = await query<any>(
      `select a.*, s.name as step_name from nofx.artifact a join nofx.step s on s.id = a.step_id where s.run_id = $1`, [runId]
    );
    res.render('run', { run: run.rows[0], artifacts: artifacts.rows });
  });
  app.get('/ui/artifacts/signed', async (req, res) => {
    const path = String(req.query.path || '');
    const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return res.status(404).send('not found');
    res.redirect(data.signedUrl);
  });
}
```

## Done
Commit: `feat(ui): add minimal console with runs list/detail & artifact download`
