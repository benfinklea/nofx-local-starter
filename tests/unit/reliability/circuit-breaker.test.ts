/**
 * Tests for Circuit Breaker pattern
 */

import { CircuitBreaker, CircuitBreakerError } from '../../../src/lib/reliability/circuit-breaker';

describe('Reliability Module - Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe('closed');
    });

    it('should execute function successfully in closed state', async () => {
      const breaker = new CircuitBreaker();
      const fn = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe('closed');
    });

    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockRejectedValue(new Error('failure'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('failure');
      }

      expect(breaker.getState()).toBe('open');
    });

    it('should reject requests when circuit is open', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const fn = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.getState()).toBe('open');

      // Next request should be rejected immediately
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerError);
      expect(fn).toHaveBeenCalledTimes(2); // Original 2 calls, not the 3rd
    });

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      // Open circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.getState()).toBe('open');

      // Advance past reset timeout
      jest.advanceTimersByTime(1001);

      // Should transition to half-open and allow one request
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('half-open');
    });

    it('should close circuit after successful recovery', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeout: 1000
      });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');

      // Open circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      // Advance past reset timeout
      jest.advanceTimersByTime(1001);

      // Execute successful requests to close circuit
      await breaker.execute(fn);
      expect(breaker.getState()).toBe('half-open');

      await breaker.execute(fn);
      expect(breaker.getState()).toBe('closed');
    });

    it('should reopen circuit on failure in half-open state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'));

      // Open circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      // Advance past reset timeout
      jest.advanceTimersByTime(1001);

      // Fail in half-open state
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.getState()).toBe('open');
    });

    it('should timeout long-running operations', async () => {
      // Use real timers for this test since we need actual timeout behavior
      jest.useRealTimers();

      const breaker = new CircuitBreaker({ timeout: 100 });
      const fn = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(breaker.execute(fn)).rejects.toThrow('timeout');

      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it('should reset failure count on success', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'));

      // First failure
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      expect(breaker.getStats().failureCount).toBe(1);

      // Success resets counter
      await breaker.execute(fn);
      expect(breaker.getStats().failureCount).toBe(0);

      // Two more failures shouldn't open circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.getState()).toBe('closed'); // Still closed because count was reset
    });

    it('should provide accurate stats', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      const stats = breaker.getStats();

      expect(stats.state).toBe('closed');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.nextRetry).toBe(0);
    });

    it('should manually reset circuit', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const fn = jest.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      expect(breaker.getState()).toBe('open');

      // Manual reset
      breaker.reset();

      expect(breaker.getState()).toBe('closed');
      expect(breaker.getStats().failureCount).toBe(0);
      expect(breaker.getStats().successCount).toBe(0);
    });

    it('should handle custom circuit name', () => {
      const breaker = new CircuitBreaker({ name: 'test-service' });

      // Name is used internally for logging/metrics
      expect(breaker.getStats().state).toBe('closed');
    });
  });

  describe('CircuitBreakerError', () => {
    it('should store circuit state', () => {
      const error = new CircuitBreakerError('Circuit is open', 'open');

      expect(error.name).toBe('CircuitBreakerError');
      expect(error.message).toBe('Circuit is open');
      expect(error.state).toBe('open');
    });
  });
});
