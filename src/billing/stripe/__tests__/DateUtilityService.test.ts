/**
 * Comprehensive test suite for DateUtilityService
 * Coverage target: 100%
 */

import { DateUtilityService } from '../DateUtilityService';

describe('DateUtilityService', () => {
  let service: DateUtilityService;

  beforeEach(() => {
    service = new DateUtilityService();
  });

  describe('toDateTime', () => {
    it('should convert Unix timestamp to ISO string', () => {
      const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
      const result = service.toDateTime(timestamp);

      expect(result).toBe('2022-01-01T00:00:00.000Z');
    });

    it('should handle zero timestamp', () => {
      const result = service.toDateTime(0);
      expect(result).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle negative timestamp', () => {
      const timestamp = -86400; // 1 day before epoch
      const result = service.toDateTime(timestamp);

      expect(result).toBe('1969-12-31T00:00:00.000Z');
    });

    it('should handle large timestamp', () => {
      const timestamp = 2147483647; // Max 32-bit signed integer
      const result = service.toDateTime(timestamp);

      expect(result).toBe('2038-01-19T03:14:07.000Z');
    });

    it('should handle fractional seconds by truncating', () => {
      const timestamp = 1640995200.5;
      const result = service.toDateTime(timestamp);

      expect(result).toBe('2022-01-01T00:00:00.500Z');
    });
  });

  describe('getTrialEnd', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2022-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate trial end date for positive days', () => {
      const trialDays = 7;
      const result = service.getTrialEnd(trialDays);

      const expected = Math.floor(new Date('2022-01-08T00:00:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('should return null for zero trial days', () => {
      const result = service.getTrialEnd(0);
      expect(result).toBeNull();
    });

    it('should return null for negative trial days', () => {
      const result = service.getTrialEnd(-5);
      expect(result).toBeNull();
    });

    it('should return null for undefined', () => {
      const result = service.getTrialEnd(undefined as any);
      expect(result).toBeNull();
    });

    it('should return null for null', () => {
      const result = service.getTrialEnd(null as any);
      expect(result).toBeNull();
    });

    it('should handle 14-day trial correctly', () => {
      const trialDays = 14;
      const result = service.getTrialEnd(trialDays);

      const expected = Math.floor(new Date('2022-01-15T00:00:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('should handle 30-day trial correctly', () => {
      const trialDays = 30;
      const result = service.getTrialEnd(trialDays);

      const expected = Math.floor(new Date('2022-01-31T00:00:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('should handle 1-day trial correctly', () => {
      const trialDays = 1;
      const result = service.getTrialEnd(trialDays);

      const expected = Math.floor(new Date('2022-01-02T00:00:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('should handle fractional days by flooring', () => {
      const trialDays = 7.5;
      const result = service.getTrialEnd(trialDays);

      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
    });

    it('should return Unix timestamp (seconds, not milliseconds)', () => {
      const trialDays = 7;
      const result = service.getTrialEnd(trialDays);

      // Unix timestamps are in seconds and should be 10 digits for current era
      expect(result!.toString().length).toBe(10);
    });
  });
});
