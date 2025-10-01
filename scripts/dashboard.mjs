#!/usr/bin/env node
/**
 * NOFX Developer Dashboard
 *
 * Your command center - shows all available commands and workflows
 *
 * Usage:
 *   npm run ?
 *   npm run help
 *   npm run dashboard
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Colors for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function header(text) {
  console.log(`\n${colors.bright}${colors.cyan}━━━ ${text} ━━━${colors.reset}\n`);
}

function cmd(command, description, hotkey = false) {
  const prefix = hotkey ? colors.green : colors.yellow;
  const emoji = hotkey ? '⚡' : '  ';
  console.log(`${emoji} ${prefix}${command.padEnd(25)}${colors.reset}${colors.dim}→ ${description}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.bright}${title}${colors.reset}`);
}

function tip(text) {
  console.log(`${colors.dim}💡 ${text}${colors.reset}`);
}

// Get project status
function getProjectStatus() {
  try {
    // Check git status
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    const hasChanges = gitStatus.trim().length > 0;

    // Check current branch
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

    // Check if behind origin
    let behindCount = 0;
    try {
      const behind = execSync('git rev-list --count HEAD..@{u}', { encoding: 'utf-8' }).trim();
      behindCount = parseInt(behind);
    } catch (e) {
      // No upstream or not connected
    }

    return { hasChanges, branch, behindCount };
  } catch (e) {
    return { hasChanges: false, branch: 'unknown', behindCount: 0 };
  }
}

// Check if DATABASE_URL is configured correctly
function checkDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL || '';
  const hasPooler = dbUrl.includes('pooler.supabase.com');
  const hasPort6543 = dbUrl.includes(':6543');
  return hasPooler && hasPort6543;
}

// Main dashboard
function showDashboard() {
  console.clear();

  // Header
  console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                   🚀 NOFX COMMAND CENTER                  ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  // Project Status
  const status = getProjectStatus();
  section('📊 Project Status');
  console.log(`   Branch: ${colors.cyan}${status.branch}${colors.reset}`);
  if (status.hasChanges) {
    console.log(`   ${colors.yellow}⚠ Uncommitted changes${colors.reset}`);
  } else {
    console.log(`   ${colors.green}✓ Working tree clean${colors.reset}`);
  }
  if (status.behindCount > 0) {
    console.log(`   ${colors.yellow}⚠ ${status.behindCount} commit(s) behind origin${colors.reset}`);
  }

  // Database check
  const dbOk = checkDatabaseUrl();
  if (!dbOk) {
    console.log(`   ${colors.red}⚠ DATABASE_URL not using transaction pooler${colors.reset}`);
  }

  // ⚡ HOTKEYS - Most used commands
  header('⚡ HOTKEYS (Most Used)');
  cmd('npm run ?', 'Show this dashboard (you are here!)', true);
  cmd('npm run d', 'Start everything (API + Worker + Frontend)', true);
  cmd('npm run t', 'Run all tests', true);
  cmd('npm run t:watch', 'Run tests in watch mode', true);
  cmd('npm run ship', 'Validate → Push → Deploy to production', true);
  cmd('npm run fix', 'Auto-fix linting issues', true);

  // Development
  header('💻 Development');
  cmd('npm run d:api', 'Start API server only');
  cmd('npm run d:fe', 'Start frontend only');
  cmd('npm run d:worker', 'Start worker only');
  cmd('npm run bootstrap:dev', 'Full dev environment setup');
  cmd('npm run clean', 'Clean install (fixes most issues)');

  // Testing
  header('🧪 Testing');
  cmd('npm run t:api', 'Run API tests');
  cmd('npm run t:e2e', 'Run E2E tests (Playwright)');
  cmd('npm run t:debug', 'Debug E2E tests with UI');
  cmd('npm run test:smoke', 'Run smoke tests');
  cmd('npm run test:load', 'Run performance tests');

  // Quality Gates
  header('🚨 Quality Gates');
  cmd('npm run gate:typecheck', 'TypeScript type checking');
  cmd('npm run gate:lint', 'ESLint validation');
  cmd('npm run gate:sast', 'Security analysis');
  cmd('npm run gate:secrets', 'Check for leaked secrets');
  cmd('npm run gates', 'Run all gates in parallel');

  // Deployment
  header('🚀 Deployment');
  cmd('npm run pre-deploy', 'Run pre-deploy validation');
  cmd('npm run ship', 'Full deploy to production');
  cmd('npm run ship:preview', 'Deploy to preview environment');
  cmd('npm run ship:fast', 'Skip validation (use carefully!)');
  cmd('npm run vercel:prod', 'Deploy to Vercel production');

  // Environment
  header('🌍 Environment');
  cmd('npm run env:check', 'Check environment parity (dev vs prod)');

  // Git Hooks
  header('🪝 Git Hooks');
  cmd('npm run hooks:full', 'Enable all hooks (thorough)');
  cmd('npm run hooks:fast', 'Enable fast hooks (balanced)');
  cmd('npm run hooks:minimal', 'Enable minimal hooks (fast)');
  cmd('npm run hooks:off', 'Disable all hooks');

  // Database
  header('🗄️ Database');
  cmd('npm run migrate:status', 'Show migration status');
  cmd('npm run migrate:up', 'Run pending migrations');
  cmd('npm run migrate:create <name>', 'Create new migration');
  cmd('npm run seed:dbwrite', 'Seed database with test data');
  cmd('npm run create:bucket', 'Create storage bucket');

  // Documentation
  header('📚 Documentation');
  console.log(`   ${colors.dim}All docs are in the project root:${colors.reset}`);
  console.log(`   • DEVELOPER_EXPERIENCE_COMPLETE.md - Full DX guide (START HERE)`);
  console.log(`   • QUICK_REFERENCE.md            - One-page cheat sheet`);
  console.log(`   • SENTRY_SETUP.md               - Error tracking setup`);
  console.log(`   • PREDICTIVE_ERROR_ANALYSIS.md  - Future bugs prevented`);
  console.log(`   • PROACTIVE_FIXES_IMPLEMENTED.md - Protection in place`);
  console.log(`   • STACK_SPECIFIC_ISSUES.md      - Vercel + Supabase fixes`);
  console.log(`   • DATABASE_POOL_FIXES.md        - Database configuration`);
  console.log(`   • PRE_DEPLOY_SYSTEM.md          - Deployment validation`);

  // Tips
  header('💡 Tips');
  tip('Run "npm run ?" anytime to see this dashboard');
  tip('The "ship" command does everything: validate + push + deploy');
  tip('Use "t:watch" for TDD - tests re-run on file changes');
  tip('Pre-deploy checks run automatically on git push');
  tip('Add "alias nofx=\'npm run dashboard\'" to your ~/.zshrc');

  // What to do next
  header('🎯 Suggested Next Steps');
  if (status.hasChanges) {
    console.log(`   ${colors.green}1.${colors.reset} Run ${colors.yellow}npm run t${colors.reset} to test your changes`);
    console.log(`   ${colors.green}2.${colors.reset} Run ${colors.yellow}npm run fix${colors.reset} to auto-fix any linting issues`);
    console.log(`   ${colors.green}3.${colors.reset} Run ${colors.yellow}npm run ship${colors.reset} to deploy`);
  } else if (status.behindCount > 0) {
    console.log(`   ${colors.green}1.${colors.reset} Run ${colors.yellow}git pull${colors.reset} to sync with origin`);
  } else {
    console.log(`   ${colors.green}1.${colors.reset} Start development: ${colors.yellow}npm run d${colors.reset}`);
    console.log(`   ${colors.green}2.${colors.reset} Run tests in watch mode: ${colors.yellow}npm run t:watch${colors.reset}`);
    console.log(`   ${colors.green}3.${colors.reset} Make your changes and run ${colors.yellow}npm run ship${colors.reset} when ready`);
  }

  console.log(`\n${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Run dashboard
showDashboard();
