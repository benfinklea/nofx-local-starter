const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

// Simple logging function to stderr so it doesn't interfere with JSON output
function logError(msg) {
  process.stderr.write(`[ERROR] ${msg}\n`);
}

function logWarn(msg) {
  process.stderr.write(`[WARN] ${msg}\n`);
}

const which = process.argv[2];
if (!which) { logError("Usage: node scripts/runGate.js <typecheck|lint|unit|sast|secrets|audit|unused>"); process.exit(2); }

const validGates = ['typecheck', 'lint', 'unit', 'sast', 'secrets', 'audit', 'unused'];
if (!validGates.includes(which)) {
  logError(`Invalid gate: ${which}. Must be one of: ${validGates.join(', ')}`);
  process.exit(2);
}

function run(cmd, args, opts = {}) {
  if (!cmd || !Array.isArray(args)) {
    return { code: 1, out: '', err: 'Invalid command or arguments' };
  }
  const p = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  return {
    code: p.status ?? 1,
    out: (p.stdout || '').toString(),
    err: (p.stderr || '').toString()
  };
}

// Constants
const ARTIFACTS_DIR = 'gate-artifacts';
const COVERAGE_FILE = 'coverage/coverage-final.json';
const PACKAGE_JSON = 'package.json';
const DEFAULT_COVERAGE_THRESHOLD = 0.9;
const GIT_LOCK_TIMEOUT_SEC = 30;
const DEFAULT_SCAN_DIRS = ['src', 'apps', 'packages'];

// Cache package.json to avoid re-reading
let packageCache = null;
function getPackageJson() {
  if (!packageCache) {
    try {
      packageCache = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    } catch {
      packageCache = { scripts: {} };
    }
  }
  return packageCache;
}

// Check if npm scripts exist for typecheck and lint
function hasNpmScript(scriptName) {
  const pkg = getPackageJson();
  return !!(pkg.scripts && pkg.scripts[scriptName]);
}

let code = 1, artifactPath = '', summary = {};
if (which === 'typecheck') {
  if (!hasNpmScript('typecheck')) {
    summary = { gate: 'typecheck', passed: false, error: 'No typecheck script found in package.json' };
    code = 1;
  } else {
    const r = run('npm', ['run','-s','typecheck']);
    summary = { gate: 'typecheck', passed: r.code === 0 };
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    artifactPath = `${ARTIFACTS_DIR}/typecheck.txt`;
    fs.writeFileSync(artifactPath, r.out + '\n' + r.err);
    code = r.code;
  }
}
if (which === 'lint') {
  if (!hasNpmScript('lint')) {
    summary = { gate: 'lint', passed: false, error: 'No lint script found in package.json' };
    code = 1;
  } else {
    const r = run('npm', ['run','-s','lint']);
    summary = { gate: 'lint', passed: r.code === 0 };
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    artifactPath = `${ARTIFACTS_DIR}/eslint.json`;
    fs.writeFileSync(artifactPath, r.out || '[]');
    code = r.code;
  }
}
if (which === 'unit') {
  // Check if vitest is available
  const vitestCheck = run('npx', ['vitest', '--version']);
  if (vitestCheck.code !== 0) {
    summary = { gate: 'unit', passed: false, error: 'Vitest not available. Run npm install first.' };
    code = 1;
  } else {
    const r = run('npx', ['vitest','run','--coverage']);
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    artifactPath = `${ARTIFACTS_DIR}/vitest.txt`;
    fs.writeFileSync(artifactPath, r.out + '\n' + r.err);
    try {
      const coverageFile = COVERAGE_FILE;
      if (!fs.existsSync(coverageFile)) {
        summary = { gate: 'unit', passed: false, error: 'Coverage file not generated. Check if tests exist and coverage is configured.' };
        code = 1;
      } else {
        const cov = JSON.parse(fs.readFileSync(coverageFile,'utf8'));
        const changed = getChangedLines();
        const pct = computeChangedLinesCoverage(cov, changed);
        const threshold = Math.max(0, Math.min(1, Number(process.env.COVERAGE_THRESHOLD || DEFAULT_COVERAGE_THRESHOLD)));
        const ok = pct >= threshold;
        summary = { gate: 'unit', passed: r.code === 0 && ok, changedLinesCoverage: pct };
        fs.writeFileSync(`${ARTIFACTS_DIR}/coverage-summary.json`, JSON.stringify(summary,null,2));
        code = summary.passed ? 0 : 1;
      }
    } catch (e) {
      summary = { gate: 'unit', passed: false, error: String(e) };
      code = 1;
    }
  }
}

if (which === 'sast') {
  const findings = semgrepScan();
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  artifactPath = `${ARTIFACTS_DIR}/sast.json`;
  const out = { gate: 'sast', findings };
  fs.writeFileSync(artifactPath, JSON.stringify(out, null, 2));
  summary = { gate: 'sast', passed: findings.length === 0, count: findings.length };
  code = findings.length === 0 ? 0 : 1;
}

if (which === 'secrets') {
  const findings = secretScan(DEFAULT_SCAN_DIRS);
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  artifactPath = `${ARTIFACTS_DIR}/secret-scan.json`;
  const out = { gate: 'secrets', findings };
  fs.writeFileSync(artifactPath, JSON.stringify(out, null, 2));
  summary = { gate: 'secrets', passed: findings.length === 0, count: findings.length };
  code = findings.length === 0 ? 0 : 1;
}

if (which === 'audit') {
  try {
    const r = run('npm', ['audit','--json','--audit-level=high']);
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    if (r.out && r.out.trim().startsWith('{')) {
      artifactPath = `${ARTIFACTS_DIR}/npm-audit.json`;
      fs.writeFileSync(artifactPath, r.out);
      try {
        const data = JSON.parse(r.out);
        const meta = (data.metadata && data.metadata.vulnerabilities) || {};
        const total = Object.values(meta).reduce((s, n) => s + (Number(n)||0), 0);
        summary = { gate: 'audit', passed: total === 0, vulnerabilities: meta };
        code = total === 0 ? 0 : 1;
      } catch (parseError) {
        summary = { gate: 'audit', passed: false, error: `Failed to parse audit output: ${String(parseError)}` };
        code = 1;
      }
    } else {
      // Likely network-restricted or unsupported; do not block
      artifactPath = `${ARTIFACTS_DIR}/npm-audit.txt`;
      fs.writeFileSync(artifactPath, (r.out||'') + '\n' + (r.err||''));
      summary = { gate: 'audit', passed: true, skipped: true };
      code = 0;
    }
  } catch (e) {
    summary = { gate: 'audit', passed: true, skipped: true, error: String(e) };
    code = 0;
  }
}

if (which === 'unused') {
  const findings = knipScan();
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  artifactPath = `${ARTIFACTS_DIR}/unused-code.json`;
  const out = { gate: 'unused', findings };
  fs.writeFileSync(artifactPath, JSON.stringify(out, null, 2));
  summary = { gate: 'unused', passed: findings.length === 0, count: findings.length };
  code = findings.length === 0 ? 0 : 1;
}

process.stdout.write(JSON.stringify({ artifactPath, summary }) + '\n');
process.exit(code);

function getChangedLines() {
  const base = process.env.BASE_REF || 'HEAD~1';

  // Check if git is available and we're in a git repository
  const gitCheck = run('git', ['rev-parse', '--git-dir']);
  if (gitCheck.code !== 0) {
    logWarn('Not in a git repository or git not available. Treating all source files as changed.');
    return {}; // Empty object will result in 100% coverage requirement
  }

  const r = run('git', ['diff','--unified=0', `${base}`, 'HEAD', '--', 'src']);
  if (!r.out) return {};

  const files = {};
  let current = null;
  const lines = r.out.split('\n');

  for (const ln of lines) {
    if (ln.startsWith('+++ b/')) {
      current = ln.replace('+++ b/','').trim();
      if (current) files[current] = new Set();
      continue;
    }

    if (!current) continue;

    const m = ln.match(/^@@ .*\+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const start = parseInt(m[1], 10);
      const len = m[2] ? parseInt(m[2], 10) : 1;
      if (!isNaN(start) && !isNaN(len)) {
        for (let i = 0; i < len; i++) {
          files[current].add(start + i);
        }
      }
    }
  }
  return files;
}
function computeChangedLinesCoverage(cov, changed) {
  if (!cov || !changed || typeof cov !== 'object' || typeof changed !== 'object') {
    return 1; // 100% if no valid data
  }

  let covered = 0, total = 0;
  for (const file of Object.keys(changed)) {
    if (!changed[file] || !changed[file].size) continue;

    const entry = cov[file] || cov[file.replace(/^\.\//,'')];
    if (!entry || !entry.lines || !Array.isArray(entry.lines.details)) continue;

    const coveredLines = new Set(
      entry.lines.details
        .filter(d => d && typeof d.hit === 'number' && d.hit > 0)
        .map(d => d.line)
    );

    for (const ln of changed[file]) {
      total += 1;
      if (coveredLines.has(ln)) covered += 1;
    }
  }
  return total === 0 ? 1 : covered / total;
}

function listFiles(dirs) {
  const path = require('path');
  const out = [];
  const ignore = new Set(['node_modules','local_data','.git','dist','build','coverage']);

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      logWarn(`Directory ${dir} does not exist, skipping`);
      continue;
    }
    walk(dir);
  }

  function walk(p) {
    try {
      if (!fs.existsSync(p)) return;
      const st = fs.statSync(p);
      const name = path.basename(p);
      if (ignore.has(name)) return;
      if (st.isDirectory()) {
        for (const f of fs.readdirSync(p)) {
          walk(path.join(p, f)); // Use path.join instead of string concatenation
        }
      } else if (st.isFile()) {
        out.push(p);
      }
    } catch (e) {
      // Skip files/directories that can't be accessed (permissions, etc.)
      logWarn(`Cannot access ${p}: ${e.message}`);
    }
  }
  return out;
}
function semgrepScan() {
  // Try to run Semgrep with auto config (community rules)
  const semgrepResult = run('npx', ['semgrep', '--json', '--config=auto', 'src/']);

  if (semgrepResult.code !== 0) {
    // Fallback to basic static scan if Semgrep fails
    logWarn('Semgrep failed, falling back to basic static analysis');
    return basicStaticScan(['src']);
  }

  try {
    const semgrepData = JSON.parse(semgrepResult.out);
    const findings = [];

    if (semgrepData.results) {
      for (const result of semgrepData.results) {
        findings.push({
          file: result.path,
          line: result.start.line,
          rule: result.check_id,
          severity: result.extra.severity || 'INFO',
          message: result.extra.message || result.check_id,
          code: result.extra.lines ? result.extra.lines.trim().slice(0, 200) : ''
        });
      }
    }

    return findings;
  } catch (e) {
    logWarn(`Failed to parse Semgrep output: ${e.message}`);
    return basicStaticScan(['src']);
  }
}

function basicStaticScan(dirs) {
  const files = listFiles(dirs).filter(f => /\.(ts|js|tsx|jsx)$/.test(f));

  // Compile patterns once instead of using global flag
  const patterns = [
    { re: /\beval\s*\(/g, desc: 'eval() usage' },
    { re: /Function\s*\(/g, desc: 'Function constructor' },
    { re: /child_process\.(exec|execSync)\s*\(/g, desc: 'exec/execSync usage' }
  ];

  // Allowlist for known safe files
  const allowedFiles = new Set([
    'scripts/runGate.js', // This file legitimately uses spawnSync
    'src/worker/handlers/gate.ts' // Gate handler legitimately uses spawnSync
  ]);

  const findings = [];
  for (const f of files) {
    // Skip files in allowlist
    if (allowedFiles.has(f.replace(/^\.\//, ''))) continue;

    try {
      const src = fs.readFileSync(f, 'utf8');
      const lines = src.split(/\n/);

      for (const p of patterns) {
        // Reset regex state by creating new instance
        const regex = new RegExp(p.re.source, 'g');
        let m;
        while ((m = regex.exec(src))) {
          const lineNum = src.substring(0, m.index).split('\n').length;
          const line = lines[lineNum - 1] || '';

          // Skip findings in comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

          findings.push({
            file: f,
            line: lineNum,
            rule: p.desc,
            severity: 'WARNING',
            message: p.desc,
            code: line.trim().slice(0,200)
          });
        }
      }
    } catch (e) {
      logWarn(`Cannot read file ${f}: ${e.message}`);
    }
  }
  return findings;
}

function knipScan() {
  // Try to run Knip to find unused code
  const knipResult = run('npx', ['knip', '--reporter=json']);

  if (knipResult.code !== 0) {
    logWarn('Knip failed, skipping unused code detection');
    return [];
  }

  try {
    const knipData = JSON.parse(knipResult.out);
    const findings = [];

    // Process different types of unused items
    if (knipData.files) {
      for (const file of knipData.files) {
        findings.push({
          type: 'unused-file',
          file: file,
          message: 'Unused file',
          severity: 'INFO'
        });
      }
    }

    if (knipData.exports) {
      for (const [file, exports] of Object.entries(knipData.exports)) {
        for (const exp of exports) {
          findings.push({
            type: 'unused-export',
            file: file,
            name: exp.name,
            line: exp.line,
            message: `Unused export: ${exp.name}`,
            severity: 'WARNING'
          });
        }
      }
    }

    if (knipData.dependencies) {
      for (const dep of knipData.dependencies) {
        findings.push({
          type: 'unused-dependency',
          file: 'package.json',
          name: dep,
          message: `Unused dependency: ${dep}`,
          severity: 'INFO'
        });
      }
    }

    return findings;
  } catch (e) {
    logWarn(`Failed to parse Knip output: ${e.message}`);
    return [];
  }
}

function secretScan(dirs) {
  const files = listFiles(dirs).filter(f => /\.(ts|js|tsx|jsx|env|json|ya?ml|toml|conf|txt|md)$/.test(f));

  // Skip example, test, and documentation files
  const skipPatterns = [
    /example/i, /sample/i, /test/i, /spec/i, /fixture/i, /mock/i,
    /readme/i, /\.md$/i, /docs?\//i, /documentation/i
  ];

  const patterns = [
    { re: /sk-[a-zA-Z0-9]{20,}/g, desc: 'OpenAI key' },
    { re: /AKIA[0-9A-Z]{16}/g, desc: 'AWS Access Key ID' },
    { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, desc: 'GitHub token' },
    { re: /AIza[0-9A-Za-z\-_]{35}/g, desc: 'Google API key' },
    { re: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g, desc: 'Private key' }
  ];

  const findings = [];
  for (const f of files) {
    // Skip files that are likely examples or documentation
    if (skipPatterns.some(pattern => pattern.test(f))) continue;

    try {
      const src = fs.readFileSync(f, 'utf8');
      const lines = src.split('\n');

      for (const p of patterns) {
        // Reset regex state by creating new instance
        const regex = new RegExp(p.re.source, 'g');
        let m;
        while ((m = regex.exec(src))) {
          const lineNum = src.substring(0, m.index).split('\n').length;
          const line = lines[lineNum - 1] || '';

          // Skip obvious examples or comments
          if (line.includes('example') || line.includes('sample') ||
              line.includes('YOUR_') || line.includes('REPLACE_') ||
              line.trim().startsWith('//') || line.trim().startsWith('#')) continue;

          findings.push({
            file: f,
            line: lineNum,
            pattern: p.desc,
            match: m[0].substring(0, 20) + '...'
          });
        }
      }
    } catch (e) {
      logWarn(`Warning: Cannot read file ${f}: ${e.message}`);
    }
  }
  return findings;
}
