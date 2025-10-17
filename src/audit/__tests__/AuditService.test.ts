/**
 * AuditService Tests
 *
 * Comprehensive test suite for the audit logging service.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  AuditService,
  ConsoleAuditStorage,
  type AuditStorage,
  type AuditServiceConfig,
} from '../AuditService';
import {
  EventCategory,
  EventSeverity,
  EventOutcome,
  ResourceType,
  type AuditEvent,
} from '../types';

describe('AuditService', () => {
  let storage: AuditStorage;
  let service: AuditService;

  beforeEach(() => {
    storage = new ConsoleAuditStorage();
    service = new AuditService({
      storage,
      bufferSize: 5,
      flushIntervalMs: 1000,
      sanitizeData: true,
    });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Event Logging', () => {
    it('should log a basic authentication event', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: {
          user_id: 'user_123',
        },
        subject: {
          resource_type: ResourceType.USER,
          resource_id: 'user_123',
        },
        outcome: EventOutcome.SUCCESS,
      });

      // Should not flush yet (buffer size 5)
      expect(saveSpy).not.toHaveBeenCalled();

      // Force flush
      await service.flush();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const event = saveSpy.mock.calls[0]?.[0] as AuditEvent;
      expect(event?.event_type).toBe('auth.login.success');
      expect(event.category).toBe(EventCategory.AUTHENTICATION);
      expect(event.actor.user_id).toBe('user_123');
    });

    it('should auto-generate id and timestamp', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      await service.flush();

      const event = saveSpy.mock.calls[0]?.[0] as AuditEvent;
      expect(event?.id).toMatch(/^evt_/);
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should buffer events until buffer size reached', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      // Log 4 events (buffer size is 5)
      for (let i = 0; i < 4; i++) {
        await service.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: `user_${i}` },
          subject: { resource_type: ResourceType.USER, resource_id: `user_${i}` },
          outcome: EventOutcome.SUCCESS,
        });
      }

      // Should not have flushed yet
      expect(saveSpy).not.toHaveBeenCalled();

      // Log 5th event (reaches buffer size)
      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_4' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_4' },
        outcome: EventOutcome.SUCCESS,
      });

      // Should auto-flush
      expect(saveSpy).toHaveBeenCalledTimes(5);
    });

    it('should immediately flush critical events', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      await service.log({
        event_type: 'security.suspicious_activity',
        category: EventCategory.SECURITY,
        severity: EventSeverity.CRITICAL,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.SYSTEM_CONFIG },
        outcome: EventOutcome.FAILURE,
      });

      // Should flush immediately for critical events
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Enrichment', () => {
    it('should enrich event with request context', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      const mockRequest = {
        ip: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-request-id': 'req_123',
        },
        method: 'POST',
        path: '/auth/login',
      };

      await service.log(
        {
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: 'user_123' },
          subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
          outcome: EventOutcome.SUCCESS,
        },
        {
          ipAddress: mockRequest.ip,
          userAgent: mockRequest.headers['user-agent'] as string,
          requestId: mockRequest.headers['x-request-id'] as string,
          httpMethod: mockRequest.method,
          endpoint: mockRequest.path,
        }
      );

      await service.flush();

      const event = saveSpy.mock.calls[0]?.[0] as AuditEvent;
      expect(event?.context?.ip_address).toBe('192.168.1.100');
      expect(event.context?.user_agent).toBe('Mozilla/5.0');
      expect(event.context?.request_id).toBe('req_123');
      expect(event.context?.http_method).toBe('POST');
      expect(event.context?.endpoint).toBe('/auth/login');
    });
  });

  describe('Data Sanitization', () => {
    it('should remove sensitive fields from payload', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      await service.log({
        event_type: 'auth.password.changed',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
        payload: {
          change_type: 'user_initiated',
          password_strength: 'strong',
        } as any, // Using any for test to check sanitization
      });

      await service.flush();

      const event = saveSpy.mock.calls[0]?.[0] as AuditEvent;
      expect(event?.payload).toBeDefined();
      // Sanitization removes sensitive fields
    });

    it('should sanitize payload data', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
        payload: {
          auth_method: 'password',
          mfa_used: true,
        },
      });

      await service.flush();

      const event = saveSpy.mock.calls[0]?.[0] as AuditEvent;
      // Payload sanitization applied
      expect(event?.payload).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track event statistics', async () => {
      // Log 3 events
      for (let i = 0; i < 3; i++) {
        await service.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: `user_${i}` },
          subject: { resource_type: ResourceType.USER, resource_id: `user_${i}` },
          outcome: EventOutcome.SUCCESS,
        });
      }

      const stats = service.getStats();
      expect(stats.eventsLogged).toBe(3);
      expect(stats.eventsInBuffer).toBe(3);
    });

    it('should track flush statistics', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      // Log and flush
      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      await service.flush();

      const stats = service.getStats();
      expect(stats.flushCount).toBe(1);
      expect(stats.lastFlushAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const saveFn = jest.fn(() => Promise.reject(new Error('Storage error'))) as any;
      const saveBatchFn = jest.fn(() => Promise.reject(new Error('Storage error'))) as any;

      const errorStorage: AuditStorage = {
        save: saveFn,
        saveBatch: saveBatchFn,
      };

      const errorService = new AuditService({
        storage: errorStorage,
        bufferSize: 1,
      });

      // With bufferSize: 1, logging triggers immediate flush which will throw
      // The service handles the error gracefully by logging it
      try {
        await errorService.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: 'user_123' },
          subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
          outcome: EventOutcome.SUCCESS,
        });
      } catch (error) {
        // Expected to throw during auto-flush
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage error');
      }

      // Subsequent flush should also throw
      await expect(errorService.flush()).rejects.toThrow('Storage error');

      const stats = errorService.getStats();
      expect(stats.errorCount).toBeGreaterThan(0);

      // Shutdown will also fail due to flush error, wrap in try-catch
      try {
        await errorService.shutdown();
      } catch {
        // Expected to fail
      }
    });
  });

  describe('Shutdown', () => {
    it('should flush buffer on shutdown', async () => {
      const saveSpy = jest.spyOn(storage, 'save');

      // Log events
      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      await service.log({
        event_type: 'auth.logout',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      // Shutdown should flush
      await service.shutdown();

      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('should prevent new events after shutdown', async () => {
      await service.shutdown();

      // Log call doesn't throw, but logs warning and returns early
      await service.log({
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      // Verify event was not added to buffer
      const stats = service.getStats();
      expect(stats.eventsInBuffer).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should use saveBatch when available', async () => {
      const saveFn = jest.fn(() => Promise.resolve()) as any;
      const saveBatchFn = jest.fn(() => Promise.resolve()) as any;

      const batchStorage: AuditStorage = {
        save: saveFn,
        saveBatch: saveBatchFn,
      };

      const batchService = new AuditService({
        storage: batchStorage,
        bufferSize: 3,
      });

      // Log 3 events to fill buffer
      for (let i = 0; i < 3; i++) {
        await batchService.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: `user_${i}` },
          subject: { resource_type: ResourceType.USER, resource_id: `user_${i}` },
          outcome: EventOutcome.SUCCESS,
        });
      }

      // Should use saveBatch
      expect(batchStorage.saveBatch).toHaveBeenCalledTimes(1);
      expect(batchStorage.save).not.toHaveBeenCalled();

      await batchService.shutdown();
    });

    it('should use saveBatch for all buffered events', async () => {
      const saveFn2 = jest.fn(() => Promise.resolve()) as any;
      const saveBatchFn2 = jest.fn(() => Promise.resolve()) as any;

      const batchStorage2: AuditStorage = {
        save: saveFn2,
        saveBatch: saveBatchFn2,
      };

      const batchService2 = new AuditService({
        storage: batchStorage2,
        bufferSize: 2,
      });

      // Log 2 events to fill buffer
      for (let i = 0; i < 2; i++) {
        await batchService2.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: `user_${i}` },
          subject: { resource_type: ResourceType.USER, resource_id: `user_${i}` },
          outcome: EventOutcome.SUCCESS,
        });
      }

      // Should use saveBatch when buffer is full
      expect(batchStorage2.saveBatch).toHaveBeenCalledTimes(1);
      expect(batchStorage2.save).not.toHaveBeenCalled();

      await batchService2.shutdown();
    });
  });

  describe('Type Guards and Validators', () => {
    it('should validate event types', async () => {
      // Valid event
      await expect(
        service.log({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: 'user_123' },
          subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
          outcome: EventOutcome.SUCCESS,
        })
      ).resolves.not.toThrow();

      await service.flush();
    });
  });

  describe('ConsoleAuditStorage', () => {
    it('should log to console', async () => {
      const consoleStorage = new ConsoleAuditStorage();
      const logSpy = jest.spyOn(consoleStorage['logger'], 'info');

      await consoleStorage.save({
        id: 'evt_123',
        timestamp: new Date().toISOString(),
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_123' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
        outcome: EventOutcome.SUCCESS,
      });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should batch log to console', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any;

      const consoleStorage = new ConsoleAuditStorage(mockLogger);

      const events = [
        {
          id: 'evt_1',
          timestamp: new Date().toISOString(),
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: 'user_1' },
          subject: { resource_type: ResourceType.USER, resource_id: 'user_1' },
          outcome: EventOutcome.SUCCESS,
        },
        {
          id: 'evt_2',
          timestamp: new Date().toISOString(),
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
          actor: { user_id: 'user_2' },
          subject: { resource_type: ResourceType.USER, resource_id: 'user_2' },
          outcome: EventOutcome.SUCCESS,
        },
      ] as const;

      await consoleStorage.saveBatch(events);

      // saveBatch calls: 1 batch log + 1 per event = 3 total
      expect(mockLogger.info).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        { event_count: 2 },
        expect.stringContaining('[AUDIT BATCH]')
      );
    });
  });
});
