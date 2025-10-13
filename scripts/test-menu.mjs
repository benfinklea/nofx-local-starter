#!/usr/bin/env node

/**
 * Interactive Test Menu
 * Makes test strategy selection easy - no need to remember commands!
 *
 * Usage: npm run t
 */

/* eslint-disable security/detect-child-process */
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

// Test strategies with metadata
const testStrategies = [
  {
    key: '1',
    name: '⚡ Changed Files Only',
    command: 'npm run test:changed',
    description: 'Only test files you modified (FASTEST)',
    time: '10-30s',
    when: 'During development',
    tier: 'lightning',
  },
  {
    key: '2',
    name: '🎯 Unit Tests',
    command: 'npm run test:unit',
    description: 'All unit tests with mocks',
    time: '1-2 min',
    when: 'Before commit',
    tier: 'fast',
  },
  {
    key: '3',
    name: '🔗 Integration Tests',
    command: 'npm run test:integration',
    description: 'Tests with real database/queue',
    time: '2-3 min',
    when: 'Before push',
    tier: 'medium',
  },
  {
    key: '4',
    name: '🌐 E2E Tests',
    command: 'npm run test:e2e',
    description: 'Full browser automation tests',
    time: '5-10 min',
    when: 'Before merge/CI',
    tier: 'slow',
  },
  {
    key: '5',
    name: '🔒 Security Tests',
    command: 'npm run test:security',
    description: 'Security and vulnerability tests',
    time: '1-2 min',
    when: 'Before push',
    tier: 'fast',
  },
  {
    key: '6',
    name: '🚀 Smoke Tests',
    command: 'npm run test:smoke',
    description: 'Quick critical path validation',
    time: '30s-1 min',
    when: 'After deploy',
    tier: 'fast',
  },
  {
    key: '7',
    name: '📊 Performance Tests',
    command: 'npm run test:benchmarks',
    description: 'Performance benchmarks',
    time: '5-10 min',
    when: 'Weekly/before release',
    tier: 'slow',
  },
  {
    key: '8',
    name: '💯 Full Suite',
    command: 'npm run test:all',
    description: 'Everything (unit + integration + e2e)',
    time: '10-20 min',
    when: 'CI/PR only',
    tier: 'slow',
  },
  {
    key: '9',
    name: '📈 Coverage Report',
    command: 'npm run test:coverage',
    description: 'Full test suite with coverage',
    time: '5-10 min',
    when: 'Weekly',
    tier: 'medium',
  },
  {
    key: 'w',
    name: '👀 Watch Mode (Changed)',
    command: 'npm run test:watch:changed',
    description: 'Auto-run tests on file changes',
    time: 'continuous',
    when: 'Active development',
    tier: 'lightning',
  },
];

// Context-aware suggestions
async function getSmartSuggestions() {
  try {
    // Check if there are uncommitted changes
    const { stdout: status } = await execAsync('git status --porcelain');
    const hasChanges = status.trim().length > 0;

    // Check if on a branch (not main)
    const { stdout: branch } = await execAsync('git branch --show-current');
    const isFeatureBranch = branch.trim() !== 'main' && branch.trim() !== 'master';

    // Check time since last test run (if cache exists)
    let cacheAge = null;
    try {
      const { stdout: cacheTime } = await execAsync('find .jest-cache -type f -name "*.json" -print -quit -exec stat -f "%m" {} \\; 2>/dev/null || echo ""');
      if (cacheTime.trim()) {
        const cacheTimestamp = parseInt(cacheTime.trim().split('\n').pop());
        cacheAge = Math.floor((Date.now() - cacheTimestamp * 1000) / 1000 / 60); // minutes
      }
    } catch {
      // Ignore cache check errors
    }

    const suggestions = [];

    if (hasChanges) {
      suggestions.push({
        strategy: '1',
        reason: '📝 You have uncommitted changes',
      });
    }

    if (isFeatureBranch && hasChanges) {
      suggestions.push({
        strategy: '2',
        reason: '🌿 Feature branch - run unit tests before commit',
      });
    }

    if (cacheAge && cacheAge > 60) {
      suggestions.push({
        strategy: '8',
        reason: `⏰ Tests haven't run in ${Math.floor(cacheAge / 60)}+ hours`,
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}

// Display the menu
async function displayMenu() {
  console.clear();
  console.log(colors.bright + colors.cyan + '\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                   🧪 TEST STRATEGY MENU                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝' + colors.reset);

  // Show smart suggestions
  const suggestions = await getSmartSuggestions();
  if (suggestions.length > 0) {
    console.log(colors.yellow + '\n💡 Suggestions based on your context:' + colors.reset);
    suggestions.forEach(({ strategy, reason }) => {
      const strat = testStrategies.find(s => s.key === strategy);
      console.log(colors.green + `   [${strategy}] ${reason}` + colors.reset);
    });
  }

  // Show tier-organized strategies
  console.log(colors.bright + '\n⚡ LIGHTNING TIER (for active development):' + colors.reset);
  testStrategies
    .filter(s => s.tier === 'lightning')
    .forEach(s => {
      console.log(`${colors.cyan}[${s.key}]${colors.reset} ${s.name} ${colors.gray}(${s.time})${colors.reset}`);
      console.log(`    ${colors.gray}${s.description}${colors.reset}`);
    });

  console.log(colors.bright + '\n🚀 FAST TIER (before commits):' + colors.reset);
  testStrategies
    .filter(s => s.tier === 'fast')
    .forEach(s => {
      console.log(`${colors.green}[${s.key}]${colors.reset} ${s.name} ${colors.gray}(${s.time})${colors.reset}`);
      console.log(`    ${colors.gray}${s.description}${colors.reset}`);
    });

  console.log(colors.bright + '\n🔷 MEDIUM TIER (before push/merge):' + colors.reset);
  testStrategies
    .filter(s => s.tier === 'medium')
    .forEach(s => {
      console.log(`${colors.blue}[${s.key}]${colors.reset} ${s.name} ${colors.gray}(${s.time})${colors.reset}`);
      console.log(`    ${colors.gray}${s.description}${colors.reset}`);
    });

  console.log(colors.bright + '\n🐢 SLOW TIER (CI/weekly):' + colors.reset);
  testStrategies
    .filter(s => s.tier === 'slow')
    .forEach(s => {
      console.log(`${colors.yellow}[${s.key}]${colors.reset} ${s.name} ${colors.gray}(${s.time})${colors.reset}`);
      console.log(`    ${colors.gray}${s.description}${colors.reset}`);
    });

  console.log(colors.gray + '\n[q] Quit' + colors.reset);
  console.log(colors.gray + '[?] Show test workflow guide' + colors.reset);
}

// Show workflow guide
function showWorkflowGuide() {
  console.clear();
  console.log(colors.bright + colors.magenta + '\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║               📚 TEST WORKFLOW GUIDE                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝' + colors.reset);

  console.log(colors.bright + '\n🎯 TYPICAL DEVELOPMENT WORKFLOW:' + colors.reset);
  console.log('');
  console.log('  1️⃣  Start coding → Run ' + colors.cyan + '[w]' + colors.reset + ' Watch Mode');
  console.log('     ' + colors.gray + 'Auto-runs tests as you code (instant feedback)' + colors.reset);
  console.log('');
  console.log('  2️⃣  Before commit → Run ' + colors.cyan + '[1]' + colors.reset + ' Changed Files');
  console.log('     ' + colors.gray + 'Quick validation of your changes (~30s)' + colors.reset);
  console.log('');
  console.log('  3️⃣  Before push → Run ' + colors.green + '[2]' + colors.reset + ' Unit Tests');
  console.log('     ' + colors.gray + 'Full unit test suite (~2min)' + colors.reset);
  console.log('');
  console.log('  4️⃣  Before PR → Run ' + colors.blue + '[3]' + colors.reset + ' Integration Tests');
  console.log('     ' + colors.gray + 'Integration + smoke tests (~3min)' + colors.reset);
  console.log('');
  console.log('  5️⃣  Let CI run → ' + colors.yellow + '[8]' + colors.reset + ' Full Suite');
  console.log('     ' + colors.gray + 'Everything runs automatically on GitHub' + colors.reset);

  console.log(colors.bright + '\n⚡ TIME SAVING EXAMPLES:' + colors.reset);
  console.log('');
  console.log('  • Working on auth? → ' + colors.cyan + 'npm test -- tests/unit/auth' + colors.reset);
  console.log('  • Fixing one test? → ' + colors.cyan + 'npm test -- worker.runner.test.ts' + colors.reset);
  console.log('  • Changed 3 files? → ' + colors.cyan + 'npm run test:changed' + colors.reset + ' (runs in 30s vs 10min)');

  console.log(colors.bright + '\n🎓 PRO TIPS:' + colors.reset);
  console.log('');
  console.log('  💡 Use watch mode during active development');
  console.log('  💡 Run full suite before going home for the day');
  console.log('  💡 Let CI handle slow tests - focus on fast iteration');
  console.log('  💡 Database pool issues? You\'re already optimizing this! 🎉');

  console.log(colors.gray + '\n\nPress any key to return to menu...' + colors.reset);
}

// Execute selected test strategy
async function executeStrategy(key) {
  const strategy = testStrategies.find(s => s.key === key);
  if (!strategy) {
    console.log(colors.red + '\n❌ Invalid selection' + colors.reset);
    return;
  }

  console.log(colors.bright + colors.green + `\n🚀 Running: ${strategy.name}` + colors.reset);
  console.log(colors.gray + `Command: ${strategy.command}` + colors.reset);
  console.log(colors.gray + `Expected time: ${strategy.time}\n` + colors.reset);

  try {
    // Execute the command and stream output
    const child = exec(strategy.command);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    await new Promise((resolve, reject) => {
      child.on('exit', code => {
        if (code === 0) {
          console.log(colors.green + '\n✅ Tests passed!' + colors.reset);
          resolve();
        } else {
          console.log(colors.red + `\n❌ Tests failed with code ${code}` + colors.reset);
          reject(new Error(`Exit code ${code}`));
        }
      });
      child.on('error', reject);
    });
  } catch (error) {
    console.log(colors.red + `\n❌ Error: ${error.message}` + colors.reset);
  }

  console.log(colors.gray + '\nPress any key to return to menu...' + colors.reset);
}

// Main interactive loop
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Enable raw mode for single-key input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let showingGuide = false;
  let awaitingReturn = false;

  await displayMenu();

  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }

    // Handle return to menu
    if (awaitingReturn) {
      awaitingReturn = false;
      showingGuide = false;
      await displayMenu();
      return;
    }

    // Handle guide view
    if (showingGuide) {
      showingGuide = false;
      await displayMenu();
      return;
    }

    // Handle menu navigation
    if (key.name === 'q') {
      console.log(colors.green + '\n👋 Happy testing!' + colors.reset);
      process.exit(0);
    } else if (key.name === 'return' || str === '?') {
      showingGuide = true;
      showWorkflowGuide();
    } else if (str) {
      const strategy = testStrategies.find(s => s.key === str);
      if (strategy) {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        await executeStrategy(str);
        awaitingReturn = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }
      } else {
        console.log(colors.red + `\n❌ Invalid option: ${str}` + colors.reset);
        setTimeout(() => displayMenu(), 1000);
      }
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log(colors.green + '\n\n👋 Happy testing!' + colors.reset);
    process.exit(0);
  });
}

// Run the menu
main().catch(error => {
  console.error(colors.red + 'Error:', error.message + colors.reset);
  process.exit(1);
});
