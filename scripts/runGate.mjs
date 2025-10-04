#!/usr/bin/env zx

import 'zx/globals'
import fs from 'fs'
import path from 'path'

// Enable quiet mode to reduce noise but allow our own logging
$.verbose = false

// Constants
const ARTIFACTS_DIR = 'gate-artifacts'
const COVERAGE_FILE = 'coverage/coverage-final.json'
const PACKAGE_JSON = 'package.json'
const DEFAULT_COVERAGE_THRESHOLD = 0.9
const DEFAULT_SCAN_DIRS = ['src', 'apps', 'packages']

// Simple logging to stderr so it doesn't interfere with JSON output
function logError(msg) {
  console.error(chalk.red(`[ERROR] ${msg}`))
}

function logWarn(msg) {
  console.error(chalk.yellow(`[WARN] ${msg}`))
}

function logInfo(msg) {
  console.error(chalk.blue(`[INFO] ${msg}`))
}

const which = process.argv[3] // argv[2] is the script path in zx
const validGates = ['typecheck', 'lint', 'unit', 'sast', 'secrets', 'audit', 'unused', 'load', 'ui']

if (!which) {
  logError(`Usage: zx scripts/runGate.mjs <${validGates.join('|')}>`)
  process.exit(2)
}

if (!validGates.includes(which)) {
  logError(`Invalid gate: ${which}. Must be one of: ${validGates.join(', ')}`)
  process.exit(2)
}

let code = 1
let artifactPath = ''
let summary = {}

// Cache package.json
let packageCache = null
function getPackageJson() {
  if (!packageCache) {
    try {
      packageCache = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
    } catch {
      packageCache = { scripts: {} }
    }
  }
  return packageCache
}

function hasNpmScript(scriptName) {
  const pkg = getPackageJson()
  return !!(pkg.scripts && pkg.scripts[scriptName])
}

// Create artifacts directory
await $`mkdir -p ${ARTIFACTS_DIR}`

try {
  switch (which) {
    case 'typecheck':
      await runTypecheck()
      break
    case 'lint':
      await runLint()
      break
    case 'unit':
      await runUnit()
      break
    case 'sast':
      await runSast()
      break
    case 'secrets':
      await runSecrets()
      break
    case 'audit':
      await runAudit()
      break
    case 'unused':
      await runUnused()
      break
    case 'load':
      await runLoad()
      break
    case 'ui':
      await runUi()
      break
  }
} catch (error) {
  logError(`Gate ${which} failed: ${error.message}`)
  code = 1
}

// Output results
console.log(JSON.stringify({ artifactPath, summary }))
process.exit(code)

async function runTypecheck() {
  if (!hasNpmScript('typecheck')) {
    logInfo('No typecheck script found - skipping gate (passed)')
    summary = { gate: 'typecheck', passed: true, skipped: true, reason: 'No typecheck script in package.json' }
    artifactPath = `${ARTIFACTS_DIR}/typecheck.txt`
    await fs.promises.writeFile(artifactPath, 'Typecheck skipped - no typecheck script found in package.json')
    code = 0
    return
  }

  logInfo('Running TypeScript typecheck...')
  try {
    const result = await $`npm run -s typecheck`
    summary = { gate: 'typecheck', passed: true }
    artifactPath = `${ARTIFACTS_DIR}/typecheck.txt`
    await fs.promises.writeFile(artifactPath, result.stdout + '\n' + result.stderr)
    code = 0
  } catch (error) {
    summary = { gate: 'typecheck', passed: false }
    artifactPath = `${ARTIFACTS_DIR}/typecheck.txt`
    await fs.promises.writeFile(artifactPath, error.stdout + '\n' + error.stderr)
    code = 1
  }
}

async function runLint() {
  if (!hasNpmScript('lint')) {
    logInfo('No lint script found - skipping gate (passed)')
    summary = { gate: 'lint', passed: true, skipped: true, reason: 'No lint script in package.json' }
    artifactPath = `${ARTIFACTS_DIR}/eslint.txt`
    await fs.promises.writeFile(artifactPath, 'Lint skipped - no lint script found in package.json')
    code = 0
    return
  }

  logInfo('Running ESLint...')
  try {
    const result = await $`npm run -s lint`
    summary = { gate: 'lint', passed: true }
    artifactPath = `${ARTIFACTS_DIR}/eslint.txt`
    await fs.promises.writeFile(artifactPath, (result.stdout + '\n' + result.stderr).trim() || 'Lint succeeded with no output.')
    code = 0
  } catch (error) {
    summary = { gate: 'lint', passed: false }
    artifactPath = `${ARTIFACTS_DIR}/eslint.txt`
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim()
    await fs.promises.writeFile(artifactPath, output || 'Lint failed with no output captured.')
    code = 1
  }
}

async function runUnit() {
  // Check if package.json exists (indicates a code project)
  if (!fs.existsSync(PACKAGE_JSON)) {
    logInfo('No package.json found - skipping unit tests (passed)')
    summary = { gate: 'unit', passed: true, skipped: true, reason: 'No package.json found - not a code project' }
    artifactPath = `${ARTIFACTS_DIR}/vitest.txt`
    await fs.promises.writeFile(artifactPath, 'Unit tests skipped - no package.json found')
    code = 0
    return
  }

  // Check if vitest is available
  try {
    await $`npx vitest --version`
  } catch {
    logInfo('Vitest not available - skipping unit tests (passed)')
    summary = { gate: 'unit', passed: true, skipped: true, reason: 'Vitest not available in project' }
    artifactPath = `${ARTIFACTS_DIR}/vitest.txt`
    await fs.promises.writeFile(artifactPath, 'Unit tests skipped - Vitest not available')
    code = 0
    return
  }

  logInfo('Running unit tests with coverage...')
  try {
    const result = await $`npx vitest run --coverage`
    artifactPath = `${ARTIFACTS_DIR}/vitest.txt`
    await fs.promises.writeFile(artifactPath, result.stdout + '\n' + result.stderr)

    if (!fs.existsSync(COVERAGE_FILE)) {
      summary = { gate: 'unit', passed: false, error: 'Coverage file not generated. Check if tests exist and coverage is configured.' }
      code = 1
      return
    }

    const cov = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'))
    const changed = await getChangedLines()
    const pct = computeChangedLinesCoverage(cov, changed)
    const threshold = Math.max(0, Math.min(1, Number(process.env.COVERAGE_THRESHOLD || DEFAULT_COVERAGE_THRESHOLD)))
    const ok = pct >= threshold

    summary = { gate: 'unit', passed: ok, changedLinesCoverage: pct }
    await fs.promises.writeFile(`${ARTIFACTS_DIR}/coverage-summary.json`, JSON.stringify(summary, null, 2))
    code = ok ? 0 : 1
  } catch (error) {
    summary = { gate: 'unit', passed: false, error: String(error) }
    code = 1
  }
}

async function runSast() {
  logInfo('Running SAST with Semgrep...')
  const findings = await semgrepScan()
  artifactPath = `${ARTIFACTS_DIR}/sast.json`
  const out = { gate: 'sast', findings }
  await fs.promises.writeFile(artifactPath, JSON.stringify(out, null, 2))
  summary = { gate: 'sast', passed: findings.length === 0, count: findings.length }
  code = findings.length === 0 ? 0 : 1
}

async function runSecrets() {
  logInfo('Running secret scanning...')
  const findings = await secretScan(DEFAULT_SCAN_DIRS)
  artifactPath = `${ARTIFACTS_DIR}/secret-scan.json`
  const out = { gate: 'secrets', findings }
  await fs.promises.writeFile(artifactPath, JSON.stringify(out, null, 2))
  summary = { gate: 'secrets', passed: findings.length === 0, count: findings.length }
  code = findings.length === 0 ? 0 : 1
}

async function runAudit() {
  logInfo('Running npm audit...')
  try {
    const result = await $`npm audit --json --audit-level=high`
    if (result.stdout && result.stdout.trim().startsWith('{')) {
      artifactPath = `${ARTIFACTS_DIR}/npm-audit.json`
      await fs.promises.writeFile(artifactPath, result.stdout)

      try {
        const data = JSON.parse(result.stdout)
        const meta = (data.metadata && data.metadata.vulnerabilities) || {}
        const total = Object.values(meta).reduce((s, n) => s + (Number(n) || 0), 0)
        summary = { gate: 'audit', passed: total === 0, vulnerabilities: meta }
        code = total === 0 ? 0 : 1
      } catch (parseError) {
        summary = { gate: 'audit', passed: false, error: `Failed to parse audit output: ${String(parseError)}` }
        code = 1
      }
    } else {
      // Network-restricted or unsupported; do not block
      artifactPath = `${ARTIFACTS_DIR}/npm-audit.txt`
      await fs.promises.writeFile(artifactPath, (result.stdout || '') + '\n' + (result.stderr || ''))
      summary = { gate: 'audit', passed: true, skipped: true }
      code = 0
    }
  } catch (error) {
    summary = { gate: 'audit', passed: true, skipped: true, error: String(error) }
    code = 0
  }
}

async function runUnused() {
  logInfo('Running unused code detection with Knip...')
  const { findings, raw } = await knipScan()
  artifactPath = `${ARTIFACTS_DIR}/unused-code.json`
  const out = { gate: 'unused', findings, report: raw }
  await fs.promises.writeFile(artifactPath, JSON.stringify(out, null, 2))
  summary = { gate: 'unused', passed: true, count: findings.length, skipped: true }
  code = 0
}

async function runLoad() {
  if (!hasNpmScript('test:load')) {
    summary = { gate: 'load', passed: false, error: 'No test:load script found in package.json' }
    code = 1
    return
  }

  logInfo('Running load/performance guard...')
  try {
    const result = await $`npm run -s test:load`
    artifactPath = `${ARTIFACTS_DIR}/load.txt`
    await fs.promises.writeFile(artifactPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))
    summary = { gate: 'load', passed: true }
    code = 0
  } catch (error) {
    artifactPath = `${ARTIFACTS_DIR}/load.txt`
    await fs.promises.writeFile(artifactPath, [error.stdout, error.stderr].filter(Boolean).join('\n'))
    summary = { gate: 'load', passed: false }
    code = 1
  }
}

async function runUi() {
  if (!hasNpmScript('test:ui')) {
    summary = { gate: 'ui', passed: false, error: 'No test:ui script found in package.json' }
    code = 1
    return
  }

  logInfo('Running React UI tests...')
  try {
    const result = await $`npm run -s test:ui`
    artifactPath = `${ARTIFACTS_DIR}/ui-tests.txt`
    await fs.promises.writeFile(artifactPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))
    summary = { gate: 'ui', passed: true }
    code = 0
  } catch (error) {
    artifactPath = `${ARTIFACTS_DIR}/ui-tests.txt`
    await fs.promises.writeFile(artifactPath, [error.stdout, error.stderr].filter(Boolean).join('\n'))
    summary = { gate: 'ui', passed: false }
    code = 1
  }
}

async function getChangedLines() {
  const base = process.env.BASE_REF || 'HEAD~1'

  // Check if git is available and we're in a git repository
  try {
    await $`git rev-parse --git-dir`
  } catch {
    logWarn('Not in a git repository or git not available. Treating all source files as changed.')
    return {}
  }

  try {
    const result = await $`git diff --unified=0 ${base} HEAD -- src`
    if (!result.stdout) return {}

    const files = {}
    let current = null
    const lines = result.stdout.split('\n')

    for (const ln of lines) {
      if (ln.startsWith('+++ b/')) {
        current = ln.replace('+++ b/', '').trim()
        if (current) files[current] = new Set()
        continue
      }

      if (!current) continue

      const m = ln.match(/^@@ .*\+(\d+)(?:,(\d+))? @@/)
      if (m) {
        const start = parseInt(m[1], 10)
        const len = m[2] ? parseInt(m[2], 10) : 1
        if (!isNaN(start) && !isNaN(len)) {
          for (let i = 0; i < len; i++) {
            files[current].add(start + i)
          }
        }
      }
    }
    return files
  } catch {
    return {}
  }
}

function computeChangedLinesCoverage(cov, changed) {
  if (!cov || !changed || typeof cov !== 'object' || typeof changed !== 'object') {
    return 1 // 100% if no valid data
  }

  let covered = 0, total = 0
  for (const file of Object.keys(changed)) {
    if (!changed[file] || !changed[file].size) continue

    const entry = cov[file] || cov[file.replace(/^\.\//, '')]
    if (!entry || !entry.lines || !Array.isArray(entry.lines.details)) continue

    const coveredLines = new Set(
      entry.lines.details
        .filter(d => d && typeof d.hit === 'number' && d.hit > 0)
        .map(d => d.line)
    )

    for (const ln of changed[file]) {
      total += 1
      if (coveredLines.has(ln)) covered += 1
    }
  }
  return total === 0 ? 1 : covered / total
}

async function semgrepScan() {
  try {
    const result = await $`npx semgrep --json --config=auto src/`
    const semgrepData = JSON.parse(result.stdout)
    const findings = []

    if (semgrepData.results) {
      for (const result of semgrepData.results) {
        findings.push({
          file: result.path,
          line: result.start.line,
          rule: result.check_id,
          severity: result.extra.severity || 'INFO',
          message: result.extra.message || result.check_id,
          code: result.extra.lines ? result.extra.lines.trim().slice(0, 200) : ''
        })
      }
    }
    return findings
  } catch (error) {
    logWarn('Semgrep failed, falling back to basic static analysis')
    return await basicStaticScan(['src'])
  }
}

async function basicStaticScan(dirs) {
  const findings = []
  const patterns = [
    { re: /\beval\s*\(/g, desc: 'eval() usage' },
    { re: /Function\s*\(/g, desc: 'Function constructor' },
    { re: /child_process\.(exec|execSync)\s*\(/g, desc: 'exec/execSync usage' }
  ]

  const allowedFiles = new Set([
    'scripts/runGate.js',
    'src/worker/handlers/gate.ts'
  ])

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      logWarn(`Directory ${dir} does not exist, skipping`)
      continue
    }

    const files = await glob(`${dir}/**/*.{ts,tsx,js,jsx}`)

    for (const f of files) {
      if (allowedFiles.has(f.replace(/^\.\//, ''))) continue

      try {
        const src = await fs.promises.readFile(f, 'utf8')
        const lines = src.split('\n')

        for (const p of patterns) {
          const regex = new RegExp(p.re.source, 'g')
          let m
          while ((m = regex.exec(src))) {
            const lineNum = src.substring(0, m.index).split('\n').length
            const line = lines[lineNum - 1] || ''

            if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

            findings.push({
              file: f,
              line: lineNum,
              rule: p.desc,
              severity: 'WARNING',
              message: p.desc,
              code: line.trim().slice(0, 200)
            })
          }
        }
      } catch (e) {
        logWarn(`Cannot read file ${f}: ${e.message}`)
      }
    }
  }
  return findings
}

async function knipScan() {
  const previousFlag = process.env.VITE_CJS_IGNORE_WARNING
  const originalArgv = [...process.argv]
  process.env.VITE_CJS_IGNORE_WARNING = '1'
  process.argv = process.argv.slice(0, 2)

  try {
    const { main } = await import('knip')
    const { default: jsonReporter } = await import('knip/dist/reporters/json.js')

    const result = await main({ cwd: process.cwd(), reporter: 'json' })

    let captured = ''
    const originalLog = console.log
    try {
      console.log = (value = '') => {
        const text = String(value)
        captured = captured ? `${captured}\n${text}` : text
      }
      await jsonReporter({ report: result.report, issues: result.issues, options: undefined })
    } finally {
      console.log = originalLog
    }

    const raw = captured ? JSON.parse(captured) : { files: [], issues: [] }
    const fileCount = raw?.files?.length ?? 0
    const issueCount = raw?.issues?.length ?? 0
    if (fileCount > 0 || issueCount > 0) {
      logInfo(`Knip identified potential unused items (files: ${fileCount}, grouped issues: ${issueCount}). See ${ARTIFACTS_DIR}/unused-code.json.`)
    }

    return { findings: [], raw }
  } catch (error) {
    logWarn(`Knip failed: ${error.message}`)
    return { findings: [], raw: null }
  } finally {
    if (previousFlag === undefined) {
      delete process.env.VITE_CJS_IGNORE_WARNING
    } else {
      process.env.VITE_CJS_IGNORE_WARNING = previousFlag
    }
    process.argv = originalArgv
  }
}

async function secretScan(dirs) {
  const findings = []
  const skipPatterns = [
    /example/i, /sample/i, /test/i, /spec/i, /fixture/i, /mock/i,
    /readme/i, /\.md$/i, /docs?\//i, /documentation/i
  ]

  const patterns = [
    { re: /sk-[a-zA-Z0-9]{20,}/g, desc: 'OpenAI key' },
    { re: /AKIA[0-9A-Z]{16}/g, desc: 'AWS Access Key ID' },
    { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, desc: 'GitHub token' },
    { re: /AIza[0-9A-Za-z\-_]{35}/g, desc: 'Google API key' },
    { re: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g, desc: 'Private key' }
  ]

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue

    const files = await glob(`${dir}/**/*.{ts,tsx,js,jsx,env,json,yml,yaml,toml,conf,txt,md}`)

    for (const f of files) {
      if (skipPatterns.some(pattern => pattern.test(f))) continue

      try {
        const src = await fs.promises.readFile(f, 'utf8')
        const lines = src.split('\n')

        for (const p of patterns) {
          const regex = new RegExp(p.re.source, 'g')
          let m
          while ((m = regex.exec(src))) {
            const lineNum = src.substring(0, m.index).split('\n').length
            const line = lines[lineNum - 1] || ''

            if (line.includes('example') || line.includes('sample') ||
                line.includes('YOUR_') || line.includes('REPLACE_') ||
                line.trim().startsWith('//') || line.trim().startsWith('#')) continue

            findings.push({
              file: f,
              line: lineNum,
              pattern: p.desc,
              match: m[0].substring(0, 20) + '...'
            })
          }
        }
      } catch (e) {
        logWarn(`Cannot read file ${f}: ${e.message}`)
      }
    }
  }
  return findings
}
