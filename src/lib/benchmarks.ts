/**
 * Performance Benchmarking System
 * Comprehensive performance monitoring and benchmarking utilities
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { metrics } from './metrics';

export interface BenchmarkResult {
  name: string;
  duration: number;
  memory?: {
    used: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface BenchmarkThresholds {
  maxDuration?: number;
  maxMemoryMB?: number;
  maxCpuPercent?: number;
}

export interface BenchmarkSuite {
  name: string;
  description?: string;
  thresholds?: BenchmarkThresholds;
  results: BenchmarkResult[];
  startTime: number;
  endTime?: number;
}

class BenchmarkRunner extends EventEmitter {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private currentSuite: string | null = null;
  private outputDir: string;

  constructor() {
    super();
    this.outputDir = join(process.cwd(), 'benchmarks', 'results');
    this.ensureOutputDir();
  }

  private ensureOutputDir() {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Create a new benchmark suite
   */
  createSuite(name: string, description?: string, thresholds?: BenchmarkThresholds): BenchmarkSuite {
    const suite: BenchmarkSuite = {
      name,
      description,
      thresholds,
      results: [],
      startTime: performance.now()
    };

    this.suites.set(name, suite);
    this.currentSuite = name;
    this.emit('suite:start', suite);

    return suite;
  }

  /**
   * Run a single benchmark
   */
  async benchmark<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    const startTime = performance.now();

    let result: T;
    let error: Error | null = null;
    let benchmarkResult: BenchmarkResult;

    try {
      result = await fn();
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);

      benchmarkResult = {
        name,
        duration: endTime - startTime,
        memory: {
          used: endMemory.heapUsed - startMemory.heapUsed,
          rss: endMemory.rss,
          heapUsed: endMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external
        },
        cpu: {
          user: endCpu.user / 1000, // Convert to milliseconds
          system: endCpu.system / 1000
        },
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          error: error?.message
        }
      };

      // Add to current suite if exists
      if (this.currentSuite && this.suites.has(this.currentSuite)) {
        this.suites.get(this.currentSuite)!.results.push(benchmarkResult);
      }

      // Record metrics
      metrics.stepDuration.observe(
        { tool: 'benchmark', status: error ? 'error' : 'success' },
        benchmarkResult.duration
      );

      this.emit('benchmark:complete', benchmarkResult);
    }

    if (!error) {
      return { result: result!, benchmark: benchmarkResult! };
    }

    throw new Error('Benchmark failed');
  }

  /**
   * Complete current suite
   */
  completeSuite(): BenchmarkSuite | null {
    if (!this.currentSuite) return null;

    const suite = this.suites.get(this.currentSuite);
    if (!suite) return null;

    suite.endTime = performance.now();
    this.emit('suite:complete', suite);

    // Check thresholds
    if (suite.thresholds) {
      const violations = this.checkThresholds(suite);
      if (violations.length > 0) {
        this.emit('suite:threshold-violation', suite, violations);
      }
    }

    this.currentSuite = null;
    return suite;
  }

  /**
   * Check threshold violations
   */
  private checkThresholds(suite: BenchmarkSuite): string[] {
    const violations: string[] = [];
    const { thresholds } = suite;

    if (!thresholds) return violations;

    for (const result of suite.results) {
      if (thresholds.maxDuration && result.duration > thresholds.maxDuration) {
        violations.push(`${result.name}: Duration ${result.duration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`);
      }

      if (thresholds.maxMemoryMB && result.memory) {
        const memoryMB = result.memory.heapUsed / (1024 * 1024);
        if (memoryMB > thresholds.maxMemoryMB) {
          violations.push(`${result.name}: Memory ${memoryMB.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryMB}MB`);
        }
      }

      if (thresholds.maxCpuPercent && result.cpu) {
        const cpuPercent = (result.cpu.user + result.cpu.system) / result.duration * 100;
        if (cpuPercent > thresholds.maxCpuPercent) {
          violations.push(`${result.name}: CPU ${cpuPercent.toFixed(2)}% exceeds threshold ${thresholds.maxCpuPercent}%`);
        }
      }
    }

    return violations;
  }

  /**
   * Get benchmark statistics
   */
  getStats(suiteName: string): {
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    avgMemoryMB: number;
    errors: number;
  } | null {
    const suite = this.suites.get(suiteName);
    if (!suite || suite.results.length === 0) return null;

    const durations = suite.results.map(r => r.duration).sort((a, b) => a - b);
    const memories = suite.results.map(r => r.memory?.heapUsed || 0);
    const errors = suite.results.filter(r => r.metadata?.error).length;

    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: suite.results.length,
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0] ?? 0,
      maxDuration: durations[durations.length - 1] ?? 0,
      p95Duration: durations[p95Index] ?? 0,
      avgMemoryMB: (memories.reduce((sum, m) => sum + m, 0) / memories.length) / (1024 * 1024),
      errors
    };
  }

  /**
   * Export results to JSON
   */
  exportResults(suiteName?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (suiteName) {
      const suite = this.suites.get(suiteName);
      if (suite) {
        const filename = join(this.outputDir, `${suiteName}-${timestamp}.json`);
        writeFileSync(filename, JSON.stringify(suite, null, 2));
        console.log(`📊 Benchmark results exported to: ${filename}`);
      }
    } else {
      const allSuites = Object.fromEntries(this.suites);
      const filename = join(this.outputDir, `all-benchmarks-${timestamp}.json`);
      writeFileSync(filename, JSON.stringify(allSuites, null, 2));
      console.log(`📊 All benchmark results exported to: ${filename}`);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(suiteName: string): string {
    const suite = this.suites.get(suiteName);
    const stats = this.getStats(suiteName);

    if (!suite || !stats) return 'No data available';

    const violations = suite.thresholds ? this.checkThresholds(suite) : [];

    return `
# Performance Benchmark Report: ${suite.name}

**Description:** ${suite.description || 'N/A'}
**Date:** ${new Date().toISOString()}
**Duration:** ${((suite.endTime || performance.now()) - suite.startTime).toFixed(2)}ms

## Summary Statistics
- **Total Benchmarks:** ${stats.count}
- **Total Duration:** ${stats.totalDuration.toFixed(2)}ms
- **Average Duration:** ${stats.avgDuration.toFixed(2)}ms
- **Min Duration:** ${stats.minDuration.toFixed(2)}ms
- **Max Duration:** ${stats.maxDuration.toFixed(2)}ms
- **P95 Duration:** ${stats.p95Duration.toFixed(2)}ms
- **Average Memory:** ${stats.avgMemoryMB.toFixed(2)}MB
- **Errors:** ${stats.errors}

${violations.length > 0 ? `
## ⚠️ Threshold Violations
${violations.map(v => `- ${v}`).join('\n')}
` : '## ✅ All Thresholds Passed'}

## Individual Results
${suite.results.map(r => `
### ${r.name}
- **Duration:** ${r.duration.toFixed(2)}ms
- **Memory:** ${((Number(r.memory?.heapUsed) || 0) / (1024 * 1024)).toFixed(2)}MB
- **CPU:** ${((r.cpu?.user || 0) + (r.cpu?.system || 0)).toFixed(2)}ms
${r.metadata?.error ? `- **Error:** ${r.metadata.error}` : ''}
`).join('\n')}
`;
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.suites.clear();
    this.currentSuite = null;
  }

  /**
   * List all suites
   */
  listSuites(): string[] {
    return Array.from(this.suites.keys());
  }
}

// Global benchmark runner instance
export const benchmarkRunner = new BenchmarkRunner();

// Convenience functions
export function createBenchmarkSuite(name: string, description?: string, thresholds?: BenchmarkThresholds) {
  return benchmarkRunner.createSuite(name, description, thresholds);
}

export function benchmark<T>(name: string, fn: () => Promise<T> | T, metadata?: Record<string, any>) {
  return benchmarkRunner.benchmark(name, fn, metadata);
}

export function completeBenchmarkSuite() {
  return benchmarkRunner.completeSuite();
}

export function getBenchmarkStats(suiteName: string) {
  return benchmarkRunner.getStats(suiteName);
}

export function exportBenchmarkResults(suiteName?: string) {
  return benchmarkRunner.exportResults(suiteName);
}

export function generateBenchmarkReport(suiteName: string) {
  return benchmarkRunner.generateReport(suiteName);
}

// Decorator for automatic benchmarking
export function benchmarked(name?: string, metadata?: Record<string, any>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const benchmarkName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const { result } = await benchmark(benchmarkName, () => originalMethod.apply(this, args), metadata);
      return result;
    };

    return descriptor;
  };
}