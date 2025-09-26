#!/usr/bin/env node

/**
 * NOFX Queue Management CLI
 * Utility for inspecting and managing the Redis queue
 */

const { Command } = require('commander');
const IORedis = require('ioredis');
const chalk = require('chalk');
const Table = require('cli-table3');
const { format } = require('date-fns');

// Load environment
require('dotenv').config();

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
const program = new Command();

// Helper functions
function formatJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return format(new Date(parseInt(timestamp)), 'yyyy-MM-dd HH:mm:ss');
}

async function getQueueStats() {
  const stats = {};

  const queues = ['step.ready', 'step.processing', 'step.completed', 'step.failed', 'step.dlq'];

  for (const queue of queues) {
    stats[queue] = await redis.llen(queue);
  }

  // Get worker heartbeat
  const heartbeat = await redis.get('nofx:worker:heartbeat');
  stats.lastHeartbeat = heartbeat ? formatDate(heartbeat) : 'No heartbeat';
  stats.workerAlive = heartbeat && (Date.now() - parseInt(heartbeat)) < 10000;

  return stats;
}

// Commands
program
  .name('queue-cli')
  .description('NOFX Queue Management CLI')
  .version('1.0.0');

// Stats command
program
  .command('stats')
  .description('Show queue statistics')
  .action(async () => {
    try {
      const stats = await getQueueStats();

      const table = new Table({
        head: ['Queue', 'Count'],
        colWidths: [20, 15]
      });

      table.push(
        ['Ready', chalk.green(stats['step.ready'])],
        ['Processing', chalk.yellow(stats['step.processing'])],
        ['Completed', chalk.blue(stats['step.completed'])],
        ['Failed', chalk.red(stats['step.failed'])],
        ['DLQ', chalk.magenta(stats['step.dlq'])],
        [],
        ['Worker Status', stats.workerAlive ? chalk.green('✓ Alive') : chalk.red('✗ Dead')],
        ['Last Heartbeat', stats.lastHeartbeat]
      );

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// List command
program
  .command('list <queue>')
  .description('List jobs in a queue')
  .option('-l, --limit <number>', 'Number of jobs to show', '10')
  .option('-f, --format <type>', 'Output format (table|json)', 'table')
  .action(async (queue, options) => {
    try {
      const queueKey = queue.includes('.') ? queue : `step.${queue}`;
      const jobs = await redis.lrange(queueKey, 0, parseInt(options.limit) - 1);

      if (jobs.length === 0) {
        console.log(chalk.yellow('No jobs in queue'));
        return;
      }

      if (options.format === 'json') {
        jobs.forEach(job => {
          console.log(formatJSON(JSON.parse(job)));
        });
      } else {
        const table = new Table({
          head: ['Index', 'Job ID', 'Run ID', 'Created'],
          colWidths: [7, 40, 40, 25]
        });

        jobs.forEach((job, index) => {
          const data = JSON.parse(job);
          table.push([
            index,
            data.stepId || data.id || 'N/A',
            data.runId || 'N/A',
            formatDate(data.createdAt)
          ]);
        });

        console.log(table.toString());
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Peek command
program
  .command('peek <queue> <index>')
  .description('View a specific job in detail')
  .action(async (queue, index) => {
    try {
      const queueKey = queue.includes('.') ? queue : `step.${queue}`;
      const job = await redis.lindex(queueKey, parseInt(index));

      if (!job) {
        console.log(chalk.yellow('Job not found'));
        return;
      }

      console.log(formatJSON(JSON.parse(job)));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Move command
program
  .command('move <from> <to>')
  .description('Move all jobs from one queue to another')
  .option('-n, --count <number>', 'Number of jobs to move', 'all')
  .action(async (from, to, options) => {
    try {
      const fromKey = from.includes('.') ? from : `step.${from}`;
      const toKey = to.includes('.') ? to : `step.${to}`;

      let count = 0;
      const limit = options.count === 'all' ? -1 : parseInt(options.count);

      while (limit === -1 || count < limit) {
        const job = await redis.rpoplpush(fromKey, toKey);
        if (!job) break;
        count++;
      }

      console.log(chalk.green(`✓ Moved ${count} jobs from ${from} to ${to}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Retry command
program
  .command('retry')
  .description('Retry all failed jobs')
  .option('-l, --limit <number>', 'Maximum jobs to retry', '100')
  .action(async (options) => {
    try {
      let count = 0;
      const limit = parseInt(options.limit);

      while (count < limit) {
        const job = await redis.rpoplpush('step.failed', 'step.ready');
        if (!job) break;
        count++;
      }

      console.log(chalk.green(`✓ Retried ${count} failed jobs`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Clear command
program
  .command('clear <queue>')
  .description('Clear all jobs from a queue')
  .option('-f, --force', 'Skip confirmation')
  .action(async (queue, options) => {
    try {
      const queueKey = queue.includes('.') ? queue : `step.${queue}`;
      const count = await redis.llen(queueKey);

      if (count === 0) {
        console.log(chalk.yellow('Queue is already empty'));
        return;
      }

      if (!options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          readline.question(
            chalk.yellow(`Are you sure you want to clear ${count} jobs from ${queue}? (y/N) `),
            resolve
          );
        });

        readline.close();

        if (answer.toLowerCase() !== 'y') {
          console.log('Cancelled');
          return;
        }
      }

      await redis.del(queueKey);
      console.log(chalk.green(`✓ Cleared ${count} jobs from ${queue}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor queue activity in real-time')
  .option('-i, --interval <seconds>', 'Refresh interval', '2')
  .action(async (options) => {
    const interval = parseInt(options.interval) * 1000;

    console.clear();
    console.log(chalk.cyan('NOFX Queue Monitor - Press Ctrl+C to exit\n'));

    const monitor = async () => {
      const stats = await getQueueStats();

      // Move cursor to top
      process.stdout.write('\x1B[3;0H');

      const table = new Table({
        head: ['Metric', 'Value', 'Change'],
        colWidths: [20, 15, 10]
      });

      // Track previous values for change detection
      if (!global.prevStats) {
        global.prevStats = {};
      }

      const addRow = (name, key, formatter = (v) => v) => {
        const current = stats[key];
        const prev = global.prevStats[key] || current;
        const change = current - prev;

        let changeStr = '';
        if (change > 0) changeStr = chalk.green(`+${change}`);
        else if (change < 0) changeStr = chalk.red(`${change}`);
        else changeStr = '-';

        table.push([name, formatter(current), changeStr]);
        global.prevStats[key] = current;
      };

      addRow('Ready Queue', 'step.ready', (v) => chalk.green(v));
      addRow('Processing', 'step.processing', (v) => chalk.yellow(v));
      addRow('Completed', 'step.completed', (v) => chalk.blue(v));
      addRow('Failed', 'step.failed', (v) => chalk.red(v));
      addRow('Dead Letter Queue', 'step.dlq', (v) => chalk.magenta(v));

      table.push(
        [],
        ['Worker Status', stats.workerAlive ? chalk.green('✓ Online') : chalk.red('✗ Offline'), '-'],
        ['Last Update', new Date().toLocaleTimeString(), '-']
      );

      console.log(table.toString());
    };

    // Initial display
    await monitor();

    // Set up interval
    setInterval(monitor, interval);
  });

// Diagnose command
program
  .command('diagnose')
  .description('Run diagnostic checks on the queue system')
  .action(async () => {
    console.log(chalk.cyan('Running NOFX Queue Diagnostics...\n'));

    const checks = [];

    // Check Redis connection
    try {
      await redis.ping();
      checks.push({ name: 'Redis Connection', status: 'pass', message: 'Connected successfully' });
    } catch (error) {
      checks.push({ name: 'Redis Connection', status: 'fail', message: error.message });
    }

    // Check worker heartbeat
    try {
      const heartbeat = await redis.get('nofx:worker:heartbeat');
      const isAlive = heartbeat && (Date.now() - parseInt(heartbeat)) < 10000;

      if (isAlive) {
        checks.push({ name: 'Worker Health', status: 'pass', message: 'Worker is alive' });
      } else {
        checks.push({
          name: 'Worker Health',
          status: 'warn',
          message: heartbeat ? `Last seen ${formatDate(heartbeat)}` : 'No heartbeat detected'
        });
      }
    } catch (error) {
      checks.push({ name: 'Worker Health', status: 'fail', message: error.message });
    }

    // Check queue consistency
    try {
      const stats = await getQueueStats();
      const hasStuck = stats['step.processing'] > 0 && !stats.workerAlive;

      if (hasStuck) {
        checks.push({
          name: 'Queue Consistency',
          status: 'warn',
          message: `${stats['step.processing']} jobs stuck in processing`
        });
      } else {
        checks.push({ name: 'Queue Consistency', status: 'pass', message: 'Queues are consistent' });
      }
    } catch (error) {
      checks.push({ name: 'Queue Consistency', status: 'fail', message: error.message });
    }

    // Check DLQ
    try {
      const dlqCount = await redis.llen('step.dlq');

      if (dlqCount > 100) {
        checks.push({
          name: 'Dead Letter Queue',
          status: 'warn',
          message: `${dlqCount} jobs in DLQ (high)`
        });
      } else if (dlqCount > 0) {
        checks.push({
          name: 'Dead Letter Queue',
          status: 'info',
          message: `${dlqCount} jobs in DLQ`
        });
      } else {
        checks.push({ name: 'Dead Letter Queue', status: 'pass', message: 'DLQ is empty' });
      }
    } catch (error) {
      checks.push({ name: 'Dead Letter Queue', status: 'fail', message: error.message });
    }

    // Display results
    const table = new Table({
      head: ['Check', 'Status', 'Details'],
      colWidths: [25, 10, 45]
    });

    checks.forEach(check => {
      let status;
      switch (check.status) {
        case 'pass': status = chalk.green('✓ PASS'); break;
        case 'warn': status = chalk.yellow('⚠ WARN'); break;
        case 'fail': status = chalk.red('✗ FAIL'); break;
        case 'info': status = chalk.blue('ℹ INFO'); break;
        default: status = check.status;
      }

      table.push([check.name, status, check.message]);
    });

    console.log(table.toString());

    // Summary
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    console.log('\n' + chalk.bold('Summary:'));
    if (failCount > 0) {
      console.log(chalk.red(`  ${failCount} check(s) failed`));
    }
    if (warnCount > 0) {
      console.log(chalk.yellow(`  ${warnCount} warning(s)`));
    }
    if (failCount === 0 && warnCount === 0) {
      console.log(chalk.green('  All checks passed!'));
    }
  });

// Export command for backup
program
  .command('export <file>')
  .description('Export queue data to a file')
  .action(async (file) => {
    try {
      const fs = require('fs').promises;
      const data = {};

      const queues = ['step.ready', 'step.processing', 'step.completed', 'step.failed', 'step.dlq'];

      for (const queue of queues) {
        const jobs = await redis.lrange(queue, 0, -1);
        data[queue] = jobs.map(j => JSON.parse(j));
      }

      await fs.writeFile(file, JSON.stringify(data, null, 2));
      console.log(chalk.green(`✓ Exported queue data to ${file}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Import command for restore
program
  .command('import <file>')
  .description('Import queue data from a file')
  .option('-f, --force', 'Clear existing data first')
  .action(async (file, options) => {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      if (options.force) {
        // Clear existing queues
        for (const queue of Object.keys(data)) {
          await redis.del(queue);
        }
      }

      let totalImported = 0;
      for (const [queue, jobs] of Object.entries(data)) {
        for (const job of jobs) {
          await redis.lpush(queue, JSON.stringify(job));
          totalImported++;
        }
      }

      console.log(chalk.green(`✓ Imported ${totalImported} jobs from ${file}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Parse arguments
program.parse(process.argv);

// Cleanup on exit
process.on('SIGINT', () => {
  redis.disconnect();
  process.exit(0);
});