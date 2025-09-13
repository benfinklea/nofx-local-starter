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
    const threshold = Math.max(0, Math.min(1, Number(process.env.COVERAGE_THRESHOLD || '0.90')));
    const ok = pct >= threshold;
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
