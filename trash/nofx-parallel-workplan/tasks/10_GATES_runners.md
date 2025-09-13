# 10_GATES — Typecheck, Lint, Unit (90% changed-lines)

**Depends on:** 00_BASE

## Files to add
- `scripts/runGate.js`
- `.eslintrc.cjs`
- `vitest.config.ts`
- `src/worker/handlers/gate.ts`

### 1) scripts/runGate.js
```js
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const which = process.argv[2];
if (!which) { console.error("Usage: node scripts/runGate.js <typecheck|lint|unit>"); process.exit(2); }

function run(cmd, args, opts = {}) {
  const p = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  return { code: p.status ?? 1, out: p.stdout || '', err: p.stderr || '' };
}

let code = 1, artifactPath = '', summary = {};
if (which === 'typecheck') {
  const r = run('npm', ['run','-s','typecheck']);
  summary = { gate: 'typecheck', passed: r.code === 0 };
  fs.mkdirSync('gate-artifacts', { recursive: true });
  artifactPath = `gate-artifacts/typecheck.txt`;
  fs.writeFileSync(artifactPath, r.out + '\n' + r.err);
  code = r.code;
}
if (which === 'lint') {
  const r = run('npm', ['run','-s','lint']);
  summary = { gate: 'lint', passed: r.code === 0 };
  fs.mkdirSync('gate-artifacts', { recursive: true });
  artifactPath = `gate-artifacts/eslint.json`;
  fs.writeFileSync(artifactPath, r.out || '[]');
  code = r.code;
}
if (which === 'unit') {
  const r = run('npx', ['vitest','run','--coverage']);
  fs.mkdirSync('gate-artifacts', { recursive: true });
  fs.writeFileSync('gate-artifacts/vitest.txt', r.out + '\n' + r.err);
  try {
    const cov = JSON.parse(fs.readFileSync('coverage/coverage-final.json','utf8'));
    const changed = getChangedLines();
    const pct = computeChangedLinesCoverage(cov, changed);
    const ok = pct >= 0.90;
    summary = { gate: 'unit', passed: r.code === 0 && ok, changedLinesCoverage: pct };
    fs.writeFileSync('gate-artifacts/coverage-summary.json', JSON.stringify(summary,null,2));
    code = summary.passed ? 0 : 1;
  } catch (e) {
    summary = { gate: 'unit', passed: false, error: String(e) };
    code = 1;
  }
}

process.stdout.write(JSON.stringify({ artifactPath, summary }) + '\n');
process.exit(code);

function getChangedLines() {
  const base = process.env.BASE_REF || 'HEAD~1';
  const r = run('git', ['diff','--unified=0', `${base}`, 'HEAD', '--', 'src']);
  const files = {}; let current = null;
  for (const ln of r.out.split('\n')) {
    if (ln.startsWith('+++ b/')) { current = ln.replace('+++ b/','').trim(); if (current) files[current] = new Set(); }
    const m = ln.match(/^@@ .*\+(\d+)(?:,(\d+))? @@/);
    if (current && m) {
      const start = parseInt(m[1],10); const len = m[2] ? parseInt(m[2],10) : 1;
      for (let i=0;i<len;i++) files[current].add(start+i);
    }
  }
  return files;
}
function computeChangedLinesCoverage(cov, changed) {
  let covered = 0, total = 0;
  for (const file of Object.keys(changed)) {
    const entry = cov[file] || cov[file.replace(/^\.\//,'')];
    if (!entry || !entry.lines || !entry.lines.details) continue;
    const coveredLines = new Set(entry.lines.details.filter(d => d.hit > 0).map(d => d.line));
    for (const ln of changed[file]) { total += 1; if (coveredLines.has(ln)) covered += 1; }
  }
  return total === 0 ? 1 : covered / total;
}
```

### 2) `.eslintrc.cjs`
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.json' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended','plugin:@typescript-eslint/recommended'],
  env: { node: true, es6: true },
  ignorePatterns: ['dist','coverage']
}
```

### 3) `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text','json','json-summary','lcov'],
      reportsDirectory: 'coverage'
    }
  }
});
```

### 4) Gate handler: `src/worker/handlers/gate.ts`
```ts
import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { spawn } from "node:child_process";

function matches(tool:string){ return /^gate:(typecheck|lint|unit)$/.test(tool); }

const handler: StepHandler = {
  match: matches,
  async run({ runId, step }) {
    const kind = step.tool.split(':')[1];
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [step.id]);
    await recordEvent(runId, "gate.started", { kind }, step.id);

    const p = spawn('node', ['scripts/runGate.js', kind], { stdio: ['ignore','pipe','pipe'] });
    let out = ''; p.stdout.on('data', d => out += d.toString());
    const code = await new Promise<number>(res => p.on('close', (c)=>res(c ?? 1)));
    let result: any = {}; try { result = JSON.parse(out.trim()); } catch {}

    const path = `runs/${runId}/steps/${step.id}/gate-${kind}.json`;
    await supabase.storage.from(ARTIFACT_BUCKET).upload(path, new Blob([JSON.stringify(result,null,2)]), { upsert: true } as any);
    await query(`insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`, [
      step.id, "application/json", path, JSON.stringify({ gate: kind })
    ]);

    const passed = code === 0 && !!result?.summary?.passed;
    await query(`update nofx.step set status=$2, outputs=$3, ended_at=now() where id=$1`, [
      step.id, passed ? 'succeeded' : 'failed', JSON.stringify({ gate: kind, result })
    ]);
    await recordEvent(runId, passed ? "gate.passed" : "gate.failed", { kind }, step.id);
    if (!passed) throw new Error(`gate ${kind} failed`);
  }
};
export default handler;
```

## Done
Commit: `feat(gates): add typecheck/lint/unit runners with evidence`
