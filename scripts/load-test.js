#!/usr/bin/env node

/**
 * NOFX Worker Load Testing Script
 * Tests the worker's ability to handle various load patterns
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const chalk = require('chalk');
const ProgressBar = require('progress');
const Table = require('cli-table3');
const { format } = require('date-fns');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';

// Test scenarios
const scenarios = {
  burst: {
    name: 'Burst Load',
    description: 'Send many jobs at once',
    jobs: 100,
    delay: 0,
    duration: 5000
  },
  sustained: {
    name: 'Sustained Load',
    description: 'Steady stream of jobs',
    jobs: 500,
    delay: 100,
    duration: 60000
  },
  spike: {
    name: 'Spike Test',
    description: 'Gradual increase then spike',
    jobs: 200,
    pattern: 'spike',
    duration: 30000
  },
  stress: {
    name: 'Stress Test',
    description: 'Push to limits',
    jobs: 1000,
    delay: 10,
    duration: 120000
  },
  soak: {
    name: 'Soak Test',
    description: 'Long-running steady load',
    jobs: 5000,
    delay: 500,
    duration: 3600000 // 1 hour
  }
};

// Job templates
const jobTemplates = [
  {
    name: 'simple-echo',
    weight: 40,
    data: {
      plan: {
        goal: 'Echo test message',
        steps: [{
          name: 'echo',
          tool: 'test:echo',
          inputs: { message: 'Load test message {{index}}' }
        }]
      }
    }
  },
  {
    name: 'multi-step',
    weight: 30,
    data: {
      plan: {
        goal: 'Multi-step processing',
        steps: [
          {
            name: 'step1',
            tool: 'test:echo',
            inputs: { message: 'Step 1 of {{index}}' }
          },
          {
            name: 'step2',
            tool: 'test:delay',
            inputs: { ms: 100 }
          },
          {
            name: 'step3',
            tool: 'test:echo',
            inputs: { message: 'Step 3 complete' }
          }
        ]
      }
    }
  },
  {
    name: 'heavy-compute',
    weight: 20,
    data: {
      plan: {
        goal: 'Heavy computation',
        steps: [{
          name: 'compute',
          tool: 'test:fibonacci',
          inputs: { n: 35 }
        }]
      }
    }
  },
  {
    name: 'error-prone',
    weight: 10,
    data: {
      plan: {
        goal: 'Error handling test',
        steps: [{
          name: 'maybe-fail',
          tool: 'test:random-fail',
          inputs: { failureRate: 0.3 }
        }]
      }
    }
  }
];

// Metrics tracking
class Metrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.jobsSent = 0;
    this.jobsCompleted = 0;
    this.jobsFailed = 0;
    this.responseTimes = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  recordJob(responseTime, success = true) {
    this.jobsSent++;
    if (success) {
      this.jobsCompleted++;
      this.responseTimes.push(responseTime);
    } else {
      this.jobsFailed++;
    }
  }

  recordError(error) {
    this.errors.push({
      time: Date.now(),
      message: error.message || error
    });
  }

  getStats() {
    const duration = (Date.now() - this.startTime) / 1000;
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);

    return {
      duration: `${duration.toFixed(1)}s`,
      jobsSent: this.jobsSent,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      successRate: `${((this.jobsCompleted / this.jobsSent) * 100).toFixed(2)}%`,
      throughput: `${(this.jobsCompleted / duration).toFixed(2)} jobs/s`,
      avgResponseTime: this.responseTimes.length > 0
        ? `${(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(2)}ms`
        : 'N/A',
      p50: sortedTimes.length > 0 ? `${sortedTimes[Math.floor(sortedTimes.length * 0.5)].toFixed(2)}ms` : 'N/A',
      p95: sortedTimes.length > 0 ? `${sortedTimes[Math.floor(sortedTimes.length * 0.95)].toFixed(2)}ms` : 'N/A',
      p99: sortedTimes.length > 0 ? `${sortedTimes[Math.floor(sortedTimes.length * 0.99)].toFixed(2)}ms` : 'N/A',
      errors: this.errors.length
    };
  }
}

// Load generator
class LoadGenerator {
  constructor(scenario, options = {}) {
    this.scenario = scenario;
    this.options = options;
    this.metrics = new Metrics();
    this.running = false;
  }

  selectJobTemplate() {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const template of jobTemplates) {
      cumulative += template.weight;
      if (random < cumulative) {
        return template;
      }
    }

    return jobTemplates[0];
  }

  async sendJob(index) {
    const template = this.selectJobTemplate();
    const job = JSON.parse(JSON.stringify(template.data));

    // Replace placeholders
    const replaceInObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace('{{index}}', index);
        } else if (typeof obj[key] === 'object') {
          replaceInObject(obj[key]);
        }
      }
    };
    replaceInObject(job);

    const startTime = performance.now();

    try {
      await axios.post(`${API_URL}/api/runs`, job, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      const responseTime = performance.now() - startTime;
      this.metrics.recordJob(responseTime, true);
    } catch (error) {
      this.metrics.recordJob(0, false);
      this.metrics.recordError(error);
    }
  }

  async runBurst() {
    const { jobs } = this.scenario;
    const bar = new ProgressBar('  Burst [:bar] :current/:total :percent :etas', {
      total: jobs,
      width: 40
    });

    const promises = [];
    for (let i = 0; i < jobs; i++) {
      promises.push(
        this.sendJob(i).then(() => bar.tick())
      );
    }

    await Promise.all(promises);
  }

  async runSustained() {
    const { jobs, delay } = this.scenario;
    const bar = new ProgressBar('  Sustained [:bar] :current/:total :percent :etas', {
      total: jobs,
      width: 40
    });

    for (let i = 0; i < jobs && this.running; i++) {
      await this.sendJob(i);
      bar.tick();
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async runSpike() {
    const { jobs } = this.scenario;
    const bar = new ProgressBar('  Spike [:bar] :current/:total :percent :etas', {
      total: jobs,
      width: 40
    });

    // Gradual ramp-up (40% of jobs)
    const rampUpJobs = Math.floor(jobs * 0.4);
    for (let i = 0; i < rampUpJobs && this.running; i++) {
      await this.sendJob(i);
      bar.tick();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Spike (50% of jobs)
    const spikeJobs = Math.floor(jobs * 0.5);
    const spikePromises = [];
    for (let i = 0; i < spikeJobs; i++) {
      spikePromises.push(
        this.sendJob(rampUpJobs + i).then(() => bar.tick())
      );
    }
    await Promise.all(spikePromises);

    // Cool down (10% of jobs)
    const coolDownJobs = jobs - rampUpJobs - spikeJobs;
    for (let i = 0; i < coolDownJobs && this.running; i++) {
      await this.sendJob(rampUpJobs + spikeJobs + i);
      bar.tick();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async run() {
    this.running = true;
    this.metrics.reset();

    console.log(chalk.cyan(`\n🚀 Starting ${this.scenario.name}`));
    console.log(chalk.gray(`   ${this.scenario.description}`));
    console.log(chalk.gray(`   Jobs: ${this.scenario.jobs}, Duration: ${this.scenario.duration}ms\n`));

    try {
      if (this.scenario.pattern === 'spike') {
        await this.runSpike();
      } else if (this.scenario.delay === 0) {
        await this.runBurst();
      } else {
        await this.runSustained();
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error.message);
    }

    this.running = false;
    return this.metrics.getStats();
  }

  stop() {
    this.running = false;
  }
}

// Health monitor
class HealthMonitor {
  constructor() {
    this.interval = null;
    this.samples = [];
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${WORKER_URL}/health`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  start(intervalMs = 5000) {
    this.interval = setInterval(async () => {
      const health = await this.checkHealth();
      this.samples.push({
        time: Date.now(),
        healthy: health !== null,
        data: health
      });
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getReport() {
    const totalSamples = this.samples.length;
    const healthySamples = this.samples.filter(s => s.healthy).length;

    return {
      uptime: `${((healthySamples / totalSamples) * 100).toFixed(2)}%`,
      samples: totalSamples,
      failures: totalSamples - healthySamples
    };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(chalk.bold('NOFX Load Testing Tool\n'));
    console.log('Usage: load-test <scenario> [options]\n');
    console.log('Scenarios:');
    Object.entries(scenarios).forEach(([key, scenario]) => {
      console.log(`  ${chalk.cyan(key.padEnd(12))} ${scenario.description}`);
    });
    console.log('\nOptions:');
    console.log('  --monitor     Enable health monitoring');
    console.log('  --report      Save detailed report');
    console.log('  --help        Show this help\n');
    console.log('Examples:');
    console.log('  load-test burst');
    console.log('  load-test sustained --monitor');
    console.log('  load-test stress --report\n');
    process.exit(0);
  }

  const scenario = scenarios[command];
  if (!scenario) {
    console.error(chalk.red(`Unknown scenario: ${command}`));
    console.log('Available scenarios:', Object.keys(scenarios).join(', '));
    process.exit(1);
  }

  const options = {
    monitor: args.includes('--monitor'),
    report: args.includes('--report')
  };

  // Check system availability
  console.log(chalk.gray('🔍 Checking system availability...'));

  try {
    await axios.get(`${API_URL}/health`, { timeout: 5000 });
    console.log(chalk.green('✓ API is available'));
  } catch (error) {
    console.error(chalk.red('✗ API is not available'));
    console.log(chalk.gray(`  Make sure the API is running at ${API_URL}`));
    process.exit(1);
  }

  try {
    await axios.get(`${WORKER_URL}/health`, { timeout: 5000 });
    console.log(chalk.green('✓ Worker is available'));
  } catch (error) {
    console.warn(chalk.yellow('⚠ Worker health check not available'));
    console.log(chalk.gray(`  Worker might not be running or health check disabled`));
  }

  // Set up monitoring if requested
  let monitor;
  if (options.monitor) {
    monitor = new HealthMonitor();
    monitor.start();
    console.log(chalk.gray('📊 Health monitoring enabled'));
  }

  // Run the load test
  const generator = new LoadGenerator(scenario, options);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠ Stopping load test...'));
    generator.stop();
    if (monitor) monitor.stop();
  });

  const stats = await generator.run();

  // Stop monitoring
  if (monitor) {
    monitor.stop();
  }

  // Display results
  console.log(chalk.bold.green('\n✅ Load Test Complete\n'));

  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [20, 20]
  });

  table.push(
    ['Duration', stats.duration],
    ['Jobs Sent', stats.jobsSent],
    ['Jobs Completed', chalk.green(stats.jobsCompleted)],
    ['Jobs Failed', stats.jobsFailed > 0 ? chalk.red(stats.jobsFailed) : '0'],
    ['Success Rate', stats.successRate],
    ['Throughput', stats.throughput],
    [],
    ['Avg Response Time', stats.avgResponseTime],
    ['P50 Latency', stats.p50],
    ['P95 Latency', stats.p95],
    ['P99 Latency', stats.p99],
    [],
    ['Errors', stats.errors > 0 ? chalk.red(stats.errors) : '0']
  );

  if (monitor) {
    const healthReport = monitor.getReport();
    table.push(
      [],
      ['Worker Uptime', healthReport.uptime],
      ['Health Checks', healthReport.samples],
      ['Health Failures', healthReport.failures > 0 ? chalk.red(healthReport.failures) : '0']
    );
  }

  console.log(table.toString());

  // Save detailed report if requested
  if (options.report) {
    const fs = require('fs').promises;
    const reportFile = `load-test-${command}-${Date.now()}.json`;

    const report = {
      scenario: scenario,
      startTime: new Date(generator.metrics.startTime).toISOString(),
      endTime: new Date().toISOString(),
      stats: stats,
      errors: generator.metrics.errors,
      healthSamples: monitor ? monitor.samples : [],
      responseTimes: generator.metrics.responseTimes
    };

    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`\n📄 Detailed report saved to ${reportFile}`));
  }

  // Analysis and recommendations
  console.log(chalk.bold('\n📈 Analysis:\n'));

  if (parseFloat(stats.successRate) < 95) {
    console.log(chalk.yellow('⚠ Success rate below 95% - investigate failures'));
  }

  if (parseFloat(stats.p99.replace('ms', '')) > 5000) {
    console.log(chalk.yellow('⚠ P99 latency above 5s - performance optimization needed'));
  }

  if (stats.errors > stats.jobsSent * 0.01) {
    console.log(chalk.red('⚠ High error rate detected - check worker logs'));
  }

  if (parseFloat(stats.throughput.replace(' jobs/s', '')) < 10) {
    console.log(chalk.yellow('⚠ Low throughput - consider scaling workers'));
  }

  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { LoadGenerator, HealthMonitor, Metrics };