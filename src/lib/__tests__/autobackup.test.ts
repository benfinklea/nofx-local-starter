/**
 * Comprehensive unit tests for autobackup.ts
 * Target Coverage: 85%
 *
 * Tests cover:
 * - Auto-backup configuration
 * - Interval management
 * - Settings integration
 * - Environment variable handling
 * - Timer lifecycle
 */

import { configureAutoBackup, initAutoBackupFromSettings, cleanupAutoBackup } from '../autobackup';

// Mock dependencies
jest.mock('../backup', () => ({
  createBackup: jest.fn().mockResolvedValue({ id: 'backup-123' })
}));

jest.mock('../settings', () => ({
  getSettings: jest.fn()
}));

describe('autobackup', () => {
  let mockCreateBackup: jest.Mock;
  let mockGetSettings: jest.Mock;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    mockCreateBackup = require('../backup').createBackup;
    mockGetSettings = require('../settings').getSettings;

    // Save original env
    originalEnv = { ...process.env };

    // Clear all mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockGetSettings.mockResolvedValue({ ops: { backupIntervalMin: 0 } });

    // Use fake timers for each test
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup autobackup timers FIRST
    cleanupAutoBackup();

    // Then clear jest timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();

    // Restore original env
    process.env = originalEnv;
  });

  describe('configureAutoBackup', () => {
    it('configures auto-backup with valid interval', () => {
      configureAutoBackup(5); // 5 minutes

      // Advance time by 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockCreateBackup).toHaveBeenCalledWith('auto-periodic');
    });

    it('does not start timer with zero interval', () => {
      configureAutoBackup(0);

      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('does not start timer with undefined interval', () => {
      configureAutoBackup(undefined);

      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('does not start timer with negative interval', () => {
      configureAutoBackup(-5);

      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('triggers backup at correct intervals', () => {
      configureAutoBackup(1); // 1 minute for faster test

      // First interval
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);

      // Second interval
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(2);

      // Third interval
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(3);
    });

    it('clears existing timer when reconfiguring', () => {
      // First configuration
      configureAutoBackup(5);

      // Reconfigure with different interval
      configureAutoBackup(10);

      // Old timer should be cleared, only new timer active
      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(mockCreateBackup).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5 * 60 * 1000); // Total 10 minutes
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    });

    it('stops auto-backup when reconfigured with 0', () => {
      // Start with interval
      configureAutoBackup(5);

      // Stop by setting to 0
      configureAutoBackup(0);

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('handles backup failures gracefully', () => {
      mockCreateBackup.mockRejectedValue(new Error('Backup failed'));

      configureAutoBackup(1);

      jest.advanceTimersByTime(1 * 60 * 1000);

      // Should not throw, error is caught
      expect(mockCreateBackup).toHaveBeenCalled();
    });

    it('continues scheduling after backup failure', () => {
      mockCreateBackup
        .mockRejectedValueOnce(new Error('First backup failed'))
        .mockResolvedValueOnce({ id: 'backup-2' });

      configureAutoBackup(1); // 1 minute for faster test

      // First interval - fails
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);

      // Second interval - succeeds
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(2);
    });

    it('passes correct note to createBackup', () => {
      configureAutoBackup(5);

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockCreateBackup).toHaveBeenCalledWith('auto-periodic');
    });
  });

  describe('initAutoBackupFromSettings', () => {
    it('initializes from environment variable', async () => {
      process.env.BACKUP_INTERVAL_MIN = '15';

      await initAutoBackupFromSettings();

      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(mockCreateBackup).toHaveBeenCalledWith('auto-periodic');
      expect(mockGetSettings).not.toHaveBeenCalled(); // Env var takes precedence
    });

    it('initializes from settings when no env var', async () => {
      delete process.env.BACKUP_INTERVAL_MIN;
      mockGetSettings.mockResolvedValue({
        ops: { backupIntervalMin: 20 }
      });

      await initAutoBackupFromSettings();

      jest.advanceTimersByTime(20 * 60 * 1000);

      expect(mockCreateBackup).toHaveBeenCalledWith('auto-periodic');
      expect(mockGetSettings).toHaveBeenCalled();
    });

    it('prefers environment variable over settings', async () => {
      process.env.BACKUP_INTERVAL_MIN = '10';
      mockGetSettings.mockResolvedValue({
        ops: { backupIntervalMin: 20 }
      });

      await initAutoBackupFromSettings();

      // Env var interval (10 min) should be used
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    });

    it('handles zero value in environment variable', async () => {
      process.env.BACKUP_INTERVAL_MIN = '0';

      await initAutoBackupFromSettings();

      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('handles invalid environment variable', async () => {
      process.env.BACKUP_INTERVAL_MIN = 'invalid';
      mockGetSettings.mockResolvedValue({
        ops: { backupIntervalMin: 5 }
      });

      await initAutoBackupFromSettings();

      // Should fall back to settings
      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalled();
    });

    it('handles missing ops in settings', async () => {
      delete process.env.BACKUP_INTERVAL_MIN;
      mockGetSettings.mockResolvedValue({});

      await initAutoBackupFromSettings();

      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('handles settings fetch errors gracefully', async () => {
      delete process.env.BACKUP_INTERVAL_MIN;
      mockGetSettings.mockRejectedValue(new Error('Settings unavailable'));

      await expect(initAutoBackupFromSettings()).resolves.not.toThrow();

      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(mockCreateBackup).not.toHaveBeenCalled();
    });
  });

  describe('Timer Lifecycle', () => {
    it('timer is created when configured', () => {
      configureAutoBackup(5);

      const timers = jest.getTimerCount();
      expect(timers).toBeGreaterThan(0);
    });

    it('handles multiple reconfigurations', () => {
      configureAutoBackup(5);
      configureAutoBackup(10);
      configureAutoBackup(15);
      configureAutoBackup(20);

      // Only the last configuration should be active
      jest.advanceTimersByTime(20 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    });

    it('properly cleans up when stopping', () => {
      configureAutoBackup(5);
      const timersBefore = jest.getTimerCount();

      configureAutoBackup(0);
      const timersAfter = jest.getTimerCount();

      expect(timersAfter).toBeLessThan(timersBefore);
    });

    it('cleanupAutoBackup clears active timers', () => {
      configureAutoBackup(5);
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      cleanupAutoBackup();

      // Timer should be cleared
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('cleanupAutoBackup is safe to call multiple times', () => {
      configureAutoBackup(5);

      cleanupAutoBackup();
      cleanupAutoBackup();
      cleanupAutoBackup();

      // Should not throw or cause issues
      expect(mockCreateBackup).not.toHaveBeenCalled();
    });

    it('cleanupAutoBackup is safe to call without active timer', () => {
      expect(() => cleanupAutoBackup()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles string number for interval', () => {
      configureAutoBackup('5' as any);

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockCreateBackup).toHaveBeenCalled();
    });

    it('handles NaN for interval', () => {
      configureAutoBackup(NaN);

      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockCreateBackup).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('creates backups at configured intervals', () => {
      configureAutoBackup(1); // 1 minute for faster test

      // First interval
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);

      // Second interval
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(2);
    });

    it('continues after backup failures', () => {
      mockCreateBackup
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({ id: 'success' });

      configureAutoBackup(1);

      // First call fails
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);

      // Second call succeeds
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(2);
    });

    it('can be dynamically adjusted', () => {
      // Initial configuration
      configureAutoBackup(10);

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);

      // Reconfigure to stop
      configureAutoBackup(0);

      jest.advanceTimersByTime(10 * 60 * 1000);
      // Should still be 1 since we stopped the timer
      expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    });
  });
});
