/**
 * Test Snapshot System for Regression Detection
 * Captures and compares test behavior to prevent regression
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface TestSnapshot {
  testName: string;
  timestamp: string;
  mockCalls: {
    functionName: string;
    args: any[];
    returnValue: any;
  }[];
  assertions: {
    type: string;
    expected: any;
    actual: any;
    passed: boolean;
  }[];
  hash: string;
}

export class TestSnapshotRecorder {
  private snapshots: Map<string, TestSnapshot> = new Map();
  private snapshotDir: string;

  constructor(testSuiteName: string) {
    this.snapshotDir = path.join(__dirname, '..', '__snapshots__', testSuiteName);
    this.ensureSnapshotDir();
  }

  private ensureSnapshotDir(): void {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Record a mock function call
   */
  recordMockCall(testName: string, functionName: string, args: any[], returnValue: any): void {
    const snapshot = this.getOrCreateSnapshot(testName);
    snapshot.mockCalls.push({
      functionName,
      args: JSON.parse(JSON.stringify(args)), // Deep clone
      returnValue: JSON.parse(JSON.stringify(returnValue))
    });
  }

  /**
   * Record an assertion
   */
  recordAssertion(testName: string, type: string, expected: any, actual: any, passed: boolean): void {
    const snapshot = this.getOrCreateSnapshot(testName);
    snapshot.assertions.push({
      type,
      expected,
      actual,
      passed
    });
  }

  /**
   * Finalize and save snapshot
   */
  finalizeSnapshot(testName: string): void {
    const snapshot = this.snapshots.get(testName);
    if (!snapshot) return;

    // Calculate hash of the snapshot
    const snapshotContent = JSON.stringify({
      mockCalls: snapshot.mockCalls,
      assertions: snapshot.assertions
    });
    snapshot.hash = crypto.createHash('sha256').update(snapshotContent).digest('hex');

    // Save to file
    const fileName = this.sanitizeFileName(testName) + '.json';
    const filePath = path.join(this.snapshotDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Compare current test run with saved snapshot
   */
  compareWithSnapshot(testName: string): {
    matches: boolean;
    differences: string[];
  } {
    const currentSnapshot = this.snapshots.get(testName);
    if (!currentSnapshot) {
      return { matches: false, differences: ['No current snapshot recorded'] };
    }

    const fileName = this.sanitizeFileName(testName) + '.json';
    const filePath = path.join(this.snapshotDir, fileName);

    if (!fs.existsSync(filePath)) {
      return { matches: false, differences: ['No saved snapshot found'] };
    }

    const savedSnapshot: TestSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const differences: string[] = [];

    // Compare hashes first
    if (currentSnapshot.hash !== savedSnapshot.hash) {
      differences.push('Snapshot hash mismatch');

      // Find specific differences
      if (currentSnapshot.mockCalls.length !== savedSnapshot.mockCalls.length) {
        differences.push(
          `Mock call count mismatch: expected ${savedSnapshot.mockCalls.length}, got ${currentSnapshot.mockCalls.length}`
        );
      }

      if (currentSnapshot.assertions.length !== savedSnapshot.assertions.length) {
        differences.push(
          `Assertion count mismatch: expected ${savedSnapshot.assertions.length}, got ${currentSnapshot.assertions.length}`
        );
      }

      // Compare individual mock calls
      for (let i = 0; i < Math.min(currentSnapshot.mockCalls.length, savedSnapshot.mockCalls.length); i++) {
        const current = currentSnapshot.mockCalls[i];
        const saved = savedSnapshot.mockCalls[i];

        if (current.functionName !== saved.functionName) {
          differences.push(`Mock call ${i}: function name mismatch`);
        }

        if (JSON.stringify(current.args) !== JSON.stringify(saved.args)) {
          differences.push(`Mock call ${i}: arguments mismatch`);
        }
      }
    }

    return {
      matches: differences.length === 0,
      differences
    };
  }

  private getOrCreateSnapshot(testName: string): TestSnapshot {
    if (!this.snapshots.has(testName)) {
      this.snapshots.set(testName, {
        testName,
        timestamp: new Date().toISOString(),
        mockCalls: [],
        assertions: [],
        hash: ''
      });
    }
    return this.snapshots.get(testName)!;
  }

  private sanitizeFileName(testName: string): string {
    return testName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Wrap a mock function to automatically record calls
 */
export function recordedMock<T extends (...args: any[]) => any>(
  recorder: TestSnapshotRecorder,
  testName: string,
  functionName: string,
  implementation?: T
): jest.Mock<ReturnType<T>, Parameters<T>> {
  const mockFn = jest.fn(implementation);

  return new Proxy(mockFn, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args);

      // Record the call
      if (result instanceof Promise) {
        return result.then((value) => {
          recorder.recordMockCall(testName, functionName, args, value);
          return value;
        });
      } else {
        recorder.recordMockCall(testName, functionName, args, result);
        return result;
      }
    }
  }) as jest.Mock<ReturnType<T>, Parameters<T>>;
}
