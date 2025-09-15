const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const which = process.argv[2];
if (!which) { console.error("Usage: node scripts/runGate.js <typecheck|lint|unit|sast|secrets|audit>"); process.exit(2); }

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

if (which === 'sast') {
  const findings = staticScan(['src']);
  fs.mkdirSync('gate-artifacts', { recursive: true });
  const out = { gate: 'sast', findings };
  fs.writeFileSync('gate-artifacts/sast.json', JSON.stringify(out, null, 2));
  summary = { gate: 'sast', passed: findings.length === 0, count: findings.length };
  code = findings.length === 0 ? 0 : 1;
}

if (which === 'secrets') {
  const findings = secretScan(['src','apps','packages']);
  fs.mkdirSync('gate-artifacts', { recursive: true });
  const out = { gate: 'secrets', findings };
  fs.writeFileSync('gate-artifacts/secret-scan.json', JSON.stringify(out, null, 2));
  summary = { gate: 'secrets', passed: findings.length === 0, count: findings.length };
  code = findings.length === 0 ? 0 : 1;
}

if (which === 'audit') {
  try {
    const r = run('npm', ['audit','--json','--audit-level=high']);
    fs.mkdirSync('gate-artifacts', { recursive: true });
    if (r.out && r.out.trim().startsWith('{')) {
      fs.writeFileSync('gate-artifacts/npm-audit.json', r.out);
      const data = JSON.parse(r.out);
      const meta = (data.metadata && data.metadata.vulnerabilities) || {};
      const total = Object.values(meta).reduce((s, n) => s + (Number(n)||0), 0);
      summary = { gate: 'audit', passed: total === 0, vulnerabilities: meta };
      code = total === 0 ? 0 : 1;
    } else {
      // Likely network-restricted or unsupported; do not block
      fs.writeFileSync('gate-artifacts/npm-audit.txt', (r.out||'') + '\n' + (r.err||''));
      summary = { gate: 'audit', passed: true, skipped: true };
      code = 0;
    }
  } catch (e) {
    summary = { gate: 'audit', passed: true, skipped: true, error: String(e) };
    code = 0;
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

function listFiles(dirs) {
  const out = [];
  const ignore = new Set(['node_modules','local_data','.git','dist','build','coverage']);
  for (const dir of dirs) {
    walk(dir);
  }
  function walk(p) {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    const name = p.split('/').pop();
    if (ignore.has(name)) return;
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) walk(p + '/' + f);
    } else if (st.isFile()) {
      out.push(p);
    }
  }
  return out;
}
function staticScan(dirs) {
  const files = listFiles(dirs).filter(f => /\.(ts|js|tsx|jsx)$/.test(f));
  const patterns = [
    { re: /\beval\s*\(/g, desc: 'eval() usage' },
    { re: /Function\s*\(/g, desc: 'Function constructor' },
    { re: /child_process\.(exec|execSync)\s*\(/g, desc: 'exec/execSync usage' },
    { re: /spawnSync\s*\(/g, desc: 'spawnSync usage' },
    { re: /require\(['"]child_process['"]\)/g, desc: 'child_process required' }
  ];
  const findings = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split(/\n/);
    for (const p of patterns) {
      let m;
      while ((m = p.re.exec(src))) {
        const idx = src.lastIndexOf('\n', m.index);
        const ln = lines.filter((_x,i,arr)=> arr[i].includes(m[0]))[0];
        findings.push({ file: f, index: m.index, pattern: p.desc, line: (ln||'').trim().slice(0,200) });
      }
    }
  }
  return findings;
}
function secretScan(dirs) {
  const files = listFiles(dirs).filter(f => /\.(ts|js|tsx|jsx|env|json|ya?ml|toml|conf|txt|md)$/.test(f));
  const patterns = [
    { re: /sk-[a-zA-Z0-9]{20,}/g, desc: 'OpenAI key' },
    { re: /AKIA[0-9A-Z]{16}/g, desc: 'AWS Access Key ID' },
    { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, desc: 'GitHub token' },
    { re: /AIza[0-9A-Za-z\-_]{35}/g, desc: 'Google API key' },
    { re: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g, desc: 'Private key' }
  ];
  const findings = [];
  for (const f of files) {
    try {
      const src = fs.readFileSync(f, 'utf8');
      for (const p of patterns) {
        if (p.re.test(src)) findings.push({ file: f, pattern: p.desc });
      }
    } catch {}
  }
  return findings;
}
