#!/usr/bin/env ts-node
/**
 * Environment Parity Validation
 *
 * Ensures local development environment matches production configuration
 * to prevent "works on my machine" issues.
 *
 * Usage:
 *   npm run env:check
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface EnvCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

const checks: EnvCheck[] = [];

function addCheck(name: string, status: 'pass' | 'warn' | 'fail', message: string, fix?: string) {
  checks.push({ name, status, message, fix });
}

/**
 * Check Node.js version matches production
 */
function checkNodeVersion() {
  const localVersion = process.version;
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
  );
  const requiredVersion = packageJson.engines?.node;

  if (!requiredVersion) {
    addCheck(
      'Node.js Version',
      'warn',
      'No Node.js version specified in package.json',
      'Add "engines": { "node": "20.x" } to package.json'
    );
    return;
  }

  const matchesRequired = localVersion.startsWith('v' + requiredVersion.replace('.x', ''));
  if (matchesRequired) {
    addCheck('Node.js Version', 'pass', `${localVersion} matches required ${requiredVersion}`);
  } else {
    addCheck(
      'Node.js Version',
      'fail',
      `${localVersion} does not match required ${requiredVersion}`,
      `Use nvm: nvm install ${requiredVersion} && nvm use ${requiredVersion}`
    );
  }
}

/**
 * Check required environment variables
 */
function checkEnvironmentVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  let allPresent = true;
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      allPresent = false;
      missing.push(varName);
    }
  }

  if (allPresent) {
    addCheck('Environment Variables', 'pass', 'All required variables present');
  } else {
    addCheck(
      'Environment Variables',
      'fail',
      `Missing: ${missing.join(', ')}`,
      'Copy from .env.example or check .env.production.template'
    );
  }
}

/**
 * Check DATABASE_URL uses transaction pooler
 */
function checkDatabasePooler() {
  const dbUrl = process.env.DATABASE_URL || '';

  const hasPooler = dbUrl.includes('pooler.supabase.com');
  const hasPort6543 = dbUrl.includes(':6543');

  if (hasPooler && hasPort6543) {
    addCheck('Database Pooler', 'pass', 'Using Supabase transaction pooler');
  } else if (dbUrl) {
    addCheck(
      'Database Pooler',
      'warn',
      'DATABASE_URL may not be using transaction pooler (port 6543)',
      'Update DATABASE_URL to use pooler.supabase.com:6543 (see DATABASE_POOL_FIXES.md)'
    );
  } else {
    addCheck('Database Pooler', 'fail', 'DATABASE_URL not set');
  }
}

/**
 * Check dependencies are installed
 */
function checkDependencies() {
  const nodeModulesExists = fs.existsSync(path.join(__dirname, '../node_modules'));

  if (!nodeModulesExists) {
    addCheck(
      'Dependencies',
      'fail',
      'node_modules not found',
      'Run: npm install'
    );
    return;
  }

  // Check for package-lock.json
  const lockFileExists = fs.existsSync(path.join(__dirname, '../package-lock.json'));
  if (!lockFileExists) {
    addCheck(
      'Dependencies',
      'warn',
      'package-lock.json not found',
      'Run: npm install to generate lockfile'
    );
  } else {
    addCheck('Dependencies', 'pass', 'Dependencies installed with lockfile');
  }
}

/**
 * Check TypeScript compilation
 */
function checkTypeScript() {
  try {
    const tsconfigPath = path.join(__dirname, '../tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      addCheck('TypeScript', 'warn', 'tsconfig.json not found');
      return;
    }

    addCheck('TypeScript', 'pass', 'TypeScript configuration present');
  } catch (error) {
    addCheck('TypeScript', 'fail', 'TypeScript configuration error');
  }
}

/**
 * Check Git status
 */
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    const hasChanges = status.trim().length > 0;

    if (hasChanges) {
      const lines = status.trim().split('\n');
      addCheck(
        'Git Status',
        'warn',
        `${lines.length} uncommitted change(s)`,
        'Commit changes before deploying'
      );
    } else {
      addCheck('Git Status', 'pass', 'Working tree clean');
    }
  } catch (error) {
    addCheck('Git Status', 'warn', 'Not a git repository');
  }
}

/**
 * Check for .env file
 */
function checkEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  const envExamplePath = path.join(__dirname, '../.env.example');

  if (fs.existsSync(envPath)) {
    addCheck('.env File', 'pass', '.env file exists');
  } else if (fs.existsSync(envExamplePath)) {
    addCheck(
      '.env File',
      'fail',
      '.env file not found',
      'Copy .env.example to .env and fill in values'
    );
  } else {
    addCheck(
      '.env File',
      'warn',
      'No .env or .env.example found',
      'Create .env file with required variables'
    );
  }
}

/**
 * Check Vercel CLI is installed (for deployments)
 */
function checkVercelCLI() {
  try {
    execSync('vercel --version', { encoding: 'utf-8', stdio: 'pipe' });
    addCheck('Vercel CLI', 'pass', 'Vercel CLI installed');
  } catch (error) {
    addCheck(
      'Vercel CLI',
      'warn',
      'Vercel CLI not installed',
      'Install: npm i -g vercel (optional, only needed for manual deploys)'
    );
  }
}

/**
 * Check build artifacts
 */
function checkBuildArtifacts() {
  const distPath = path.join(__dirname, '../dist');
  const feDistPath = path.join(__dirname, '../apps/frontend/dist');

  const hasBackendBuild = fs.existsSync(distPath);
  const hasFrontendBuild = fs.existsSync(feDistPath);

  if (!hasBackendBuild || !hasFrontendBuild) {
    addCheck(
      'Build Artifacts',
      'warn',
      'No build artifacts found',
      'Run: npm run build (will be built on deploy)'
    );
  } else {
    addCheck('Build Artifacts', 'pass', 'Build artifacts present');
  }
}

// Run all checks
function runChecks() {
  console.log('🔍 Environment Parity Check\n');

  checkNodeVersion();
  checkEnvironmentVariables();
  checkDatabasePooler();
  checkDependencies();
  checkTypeScript();
  checkGitStatus();
  checkEnvFile();
  checkVercelCLI();
  checkBuildArtifacts();

  // Display results
  console.log('Results:\n');

  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.fix && check.status !== 'pass') {
      console.log(`   💡 Fix: ${check.fix}`);
    }
  }

  console.log(`\n📊 Summary: ${passed} passed, ${warnings} warnings, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ Environment parity check failed. Fix the errors above before deploying.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  Environment parity check passed with warnings. Review warnings above.\n');
  } else {
    console.log('✅ Environment parity check passed! Local environment matches production config.\n');
  }
}

// Run checks
runChecks();
