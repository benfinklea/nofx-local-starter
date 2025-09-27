/**
 * Helper functions to add correlation IDs to store operations
 */

import { getContext, log } from '../observability';

/**
 * Wraps a store method to automatically log with correlation ID
 */
export function withCorrelationLogging<T extends (...args: any[]) => any>(
  operationName: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const ctx = getContext();
    const correlationId = ctx?.correlationId;
    const runId = ctx?.runId;
    const stepId = ctx?.stepId;

    log.debug({
      event: `store.${operationName}.started`,
      correlationId,
      runId,
      stepId,
      args: args.length
    }, `Starting ${operationName}`);

    const startTime = Date.now();

    try {
      const result = await fn(...args);

      log.debug({
        event: `store.${operationName}.completed`,
        correlationId,
        runId,
        stepId,
        duration: Date.now() - startTime
      }, `Completed ${operationName}`);

      return result;
    } catch (error) {
      log.error({
        event: `store.${operationName}.failed`,
        correlationId,
        runId,
        stepId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      }, `Failed ${operationName}`);

      throw error;
    }
  }) as T;
}

/**
 * Decorator for class methods to add correlation logging
 */
export function LogWithCorrelation(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const opName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = withCorrelationLogging(opName, originalMethod);

    return descriptor;
  };
}

/**
 * Example usage for store operations
 */
export class CorrelationExample {
  @LogWithCorrelation('createRun')
  async createRun(data: any) {
    // This method will automatically log with correlation ID
    return { id: 'run_123', ...data };
  }

  @LogWithCorrelation('updateStep')
  async updateStep(stepId: string, data: any) {
    // This will also include correlation ID in logs
    return { stepId, ...data };
  }
}