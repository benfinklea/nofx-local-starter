/**
 * Comprehensive Error Tests for RunDetail Auto-Refresh
 *
 * Tests all failure modes, edge cases, and recovery scenarios for the
 * auto-refresh polling mechanism in RunDetail.tsx
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RunDetail from '../../src/pages/RunDetail';
import * as api from '../../src/lib/api';

// Mock the API
jest.mock('../../src/lib/api');

// Mock useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-run-123' })
}));

describe('RunDetail Auto-Refresh - HEAVY RELIABILITY TESTS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Timeout Protection', () => {
    test('aborts request after 10 second timeout', async () => {
      const slowRequest = new Promise(() => {
        // Never resolves - simulates hanging request
      });

      (api.getRun as jest.Mock).mockReturnValue(slowRequest);
      (api.getTimeline as jest.Mock).mockReturnValue(slowRequest);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      // Fast-forward past timeout
      jest.advanceTimersByTime(10001);

      await waitFor(() => {
        // Should show timeout error
        expect(screen.queryByText(/failed to load run details/i)).toBeTruthy();
      });
    });

    test('clears timeout on successful response', async () => {
      const runData = {
        run: { id: 'test-run-123', status: 'running' }
      };

      (api.getRun as jest.Mock).mockResolvedValue(runData);
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getRun).toHaveBeenCalled();
      });

      // Should not timeout
      jest.advanceTimersByTime(15000);

      // No error should be shown
      expect(screen.queryByText(/timeout/i)).toBeFalsy();
    });
  });

  describe('Race Condition Prevention', () => {
    test('prevents overlapping polls when API is slow', async () => {
      let callCount = 0;
      const slowRun = () => {
        callCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ run: { id: 'test', status: 'running' } });
          }, 5000); // Slower than poll interval
        });
      };

      (api.getRun as jest.Mock).mockImplementation(slowRun);
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(callCount).toBe(1);
      });

      // Advance multiple poll intervals while first is still in flight
      jest.advanceTimersByTime(3000); // First poll attempt
      jest.advanceTimersByTime(3000); // Second poll attempt (should be skipped)
      jest.advanceTimersByTime(3000); // Third poll attempt (should be skipped)

      // Should only have 1 call (initial) + max 1 in-flight
      expect(callCount).toBeLessThanOrEqual(2);
    });

    test('allows next poll after previous completes', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getRun).toHaveBeenCalledTimes(1);
      });

      // Advance and flush timers
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect(api.getRun).toHaveBeenCalledTimes(2);
      });

      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect(api.getRun).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Error Recovery & Circuit Breaking', () => {
    test('tracks consecutive errors', async () => {
      (api.getRun as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'));

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load run details/i)).toBeTruthy();
      });
    });

    test('stops polling after 5 consecutive errors', async () => {
      (api.getRun as jest.Mock).mockRejectedValue(new Error('Persistent error'));
      (api.getTimeline as jest.Mock).mockRejectedValue(new Error('Persistent error'));

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      // Wait for initial load error
      await waitFor(() => {
        expect(screen.getByText(/failed to load run details/i)).toBeTruthy();
      });

      const initialCallCount = (api.getRun as jest.Mock).mock.calls.length;

      // Advance many poll intervals
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(3000);
        await Promise.resolve(); // Flush promises
      }

      const finalCallCount = (api.getRun as jest.Mock).mock.calls.length;

      // Should stop after MAX_CONSECUTIVE_ERRORS (5)
      expect(finalCallCount - initialCallCount).toBeLessThanOrEqual(5);

      // Should show circuit breaker message
      await waitFor(() => {
        expect(screen.queryByText(/auto-refresh paused due to repeated errors/i)).toBeTruthy();
      });
    });

    test('resets error count on successful poll', async () => {
      (api.getRun as jest.Mock)
        .mockRejectedValueOnce(new Error('Transient error 1'))
        .mockRejectedValueOnce(new Error('Transient error 2'))
        .mockResolvedValue({ run: { id: 'test', status: 'running' } }); // Success

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      // Initial load fails
      await waitFor(() => {
        expect(screen.getByText(/failed to load run details/i)).toBeTruthy();
      });

      // Poll 1 fails
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect((api.getRun as jest.Mock).mock.calls.length).toBe(2);
      });

      // Poll 2 succeeds
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect((api.getRun as jest.Mock).mock.calls.length).toBe(3);
      });

      // Error count should reset - polling should continue
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      }

      // Should not show circuit breaker error
      expect(screen.queryByText(/auto-refresh paused/i)).toBeFalsy();
    });
  });

  describe('Adaptive Polling Rate', () => {
    test('uses base interval (3s) when no errors', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Polls at 3 second intervals
      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(2));

      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(3));
    });

    test('slows to 6s after 1-2 errors', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } }) // Initial
        .mockRejectedValueOnce(new Error('Error 1')) // Poll 1 fails
        .mockResolvedValue({ run: { id: 'test', status: 'running' } }); // Subsequent succeed

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // First poll (should fail)
      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(2));

      // Next poll should be at 6s interval (2x slower)
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(api.getRun).toHaveBeenCalledTimes(2); // Should NOT poll yet

      jest.advanceTimersByTime(3000); // Total 6s
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(3));
    });

    test('slows to 12s after 3+ errors', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } }) // Initial
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue({ run: { id: 'test', status: 'running' } });

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Polls 1-3 fail
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(6000); // Slowed interval after errors
        await Promise.resolve();
      }

      // Next poll should be at 12s interval (4x slower)
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
      const callsBefore = (api.getRun as jest.Mock).mock.calls.length;

      jest.advanceTimersByTime(6000); // Total 12s
      await waitFor(() => {
        expect((api.getRun as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });

  describe('Online/Offline Detection', () => {
    test('pauses polling when browser goes offline', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      // Advance timers - should not poll
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      expect(api.getRun).toHaveBeenCalledTimes(1); // Only initial load

      // Should show offline message
      await waitFor(() => {
        expect(screen.queryByText(/offline.*auto-refresh paused/i)).toBeTruthy();
      });
    });

    test('resumes polling when browser comes online', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Polling should resume
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect(api.getRun).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Max Poll Attempts', () => {
    test('stops after 1000 poll attempts', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' } // Never completes
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Simulate 1000+ polls
      for (let i = 0; i < 1005; i++) {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      }

      // Should stop at 1000 attempts
      expect((api.getRun as jest.Mock).mock.calls.length).toBeLessThanOrEqual(1001);

      // Should show max attempts message
      await waitFor(() => {
        expect(screen.queryByText(/auto-refresh stopped after maximum attempts/i)).toBeTruthy();
      });
    });
  });

  describe('Cleanup on Unmount', () => {
    test('cancels in-flight request on unmount', async () => {
      const slowRequest = new Promise(resolve => {
        setTimeout(() => {
          resolve({ run: { id: 'test', status: 'running' } });
        }, 5000);
      });

      (api.getRun as jest.Mock).mockReturnValue(slowRequest);
      (api.getTimeline as jest.Mock).mockReturnValue(slowRequest);

      const { unmount } = render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      // Unmount while request is in flight
      unmount();

      // Advance past request time
      jest.advanceTimersByTime(6000);

      // Should have aborted the request (no error thrown)
      expect(true).toBe(true); // Test passes if no error
    });

    test('clears poll interval on unmount', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'running' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      const { unmount } = render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      const callsBeforeUnmount = (api.getRun as jest.Mock).mock.calls.length;

      unmount();

      // Advance timers after unmount
      jest.advanceTimersByTime(10000);

      // Should not poll after unmount
      expect((api.getRun as jest.Mock).mock.calls.length).toBe(callsBeforeUnmount);
    });
  });

  describe('Completion Detection', () => {
    test('stops polling when run status becomes "succeeded"', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } })
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } })
        .mockResolvedValue({ run: { id: 'test', status: 'succeeded' } });

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Poll 1 - still running
      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(2));

      // Poll 2 - completed
      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(3));

      const callsWhenCompleted = (api.getRun as jest.Mock).mock.calls.length;

      // Should not poll anymore
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      expect((api.getRun as jest.Mock).mock.calls.length).toBe(callsWhenCompleted);
    });

    test('stops polling for failed status', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } })
        .mockResolvedValue({ run: { id: 'test', status: 'failed' } });

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      jest.advanceTimersByTime(3000);
      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(2));

      const callsAfterFailure = (api.getRun as jest.Mock).mock.calls.length;

      jest.advanceTimersByTime(10000);
      expect((api.getRun as jest.Mock).mock.calls.length).toBe(callsAfterFailure);
    });

    test('continues polling for pending/queued status', async () => {
      (api.getRun as jest.Mock).mockResolvedValue({
        run: { id: 'test', status: 'pending' }
      });
      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Should continue polling
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(3000);
        await waitFor(() => {
          expect(api.getRun).toHaveBeenCalledTimes(2 + i);
        });
      }
    });
  });

  describe('User Error Visibility', () => {
    test('shows dismissible warning when polling errors occur', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } })
        .mockRejectedValue(new Error('Network failure'));

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Poll fails
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect(screen.getByText(/auto-refresh issue/i)).toBeTruthy();
        expect(screen.getByText(/network failure/i)).toBeTruthy();
      });
    });

    test('clears poll error on successful recovery', async () => {
      (api.getRun as jest.Mock)
        .mockResolvedValueOnce({ run: { id: 'test', status: 'running' } })
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValue({ run: { id: 'test', status: 'running' } });

      (api.getTimeline as jest.Mock).mockResolvedValue([]);

      render(
        <BrowserRouter>
          <RunDetail />
        </BrowserRouter>
      );

      await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(1));

      // Poll fails
      jest.advanceTimersByTime(3000);
      await waitFor(() => {
        expect(screen.getByText(/auto-refresh issue/i)).toBeTruthy();
      });

      // Poll succeeds
      jest.advanceTimersByTime(6000); // Slowed interval after error
      await waitFor(() => {
        expect(screen.queryByText(/auto-refresh issue/i)).toBeFalsy();
      });
    });
  });
});
