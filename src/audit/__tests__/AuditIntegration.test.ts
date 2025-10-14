/**
 * AuditIntegration Tests
 *
 * Test suite for RBAC and Express integration.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditIntegration } from '../integrations/AuditIntegration';
import type { AuditService } from '../AuditService';
import type { Request, Response, NextFunction } from 'express';
import { EventCategory, EventSeverity } from '../types';
import { OrganizationPermission, OrganizationRole } from '../../lib/organizations.types';

describe('AuditIntegration', () => {
  let mockAuditService: AuditService;
  let integration: AuditIntegration;

  beforeEach(() => {
    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
      flush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn(),
    } as any;

    integration = new AuditIntegration({
      auditService: mockAuditService,
    });
  });

  describe('Authentication Logging', () => {
    it('should log successful login', async () => {
      await integration.logAuthentication({
        type: 'login_success',
        userId: 'user_123',
        method: 'password',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'auth.login.success',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.INFO,
        }),
        undefined
      );
    });

    it('should log failed login', async () => {
      await integration.logAuthentication({
        type: 'login_failure',
        userId: 'user_123',
        method: 'password',
        reason: 'Invalid password',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'auth.login.failure',
          category: EventCategory.AUTHENTICATION,
          severity: EventSeverity.WARNING,
          payload: expect.objectContaining({
            reason: 'Invalid password',
          }),
        }),
        undefined
      );
    });

    it('should log API key usage', async () => {
      await integration.logApiKeyUsage({
        userId: 'user_123',
        apiKeyId: 'key_abc',
        endpoint: '/api/projects',
        method: 'GET',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'auth.token.created',
          actor: expect.objectContaining({
            user_id: 'user_123',
            api_client_id: 'key_abc',
          }),
        }),
        undefined
      );
    });
  });

  describe('Authorization Logging', () => {
    it('should log permission granted', async () => {
      await integration.logAuthorization({
        type: 'permission_granted',
        userId: 'user_123',
        organizationId: 'org_456',
        permission: OrganizationPermission.PROJECTS_WRITE,
        resourceType: 'project',
        resourceId: 'proj_789',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'authz.permission.granted',
          category: EventCategory.AUTHORIZATION,
          severity: EventSeverity.INFO,
          payload: expect.objectContaining({
            permission: OrganizationPermission.PROJECTS_WRITE,
          }),
        }),
        undefined
      );
    });

    it('should log permission denied', async () => {
      await integration.logAuthorization({
        type: 'permission_denied',
        userId: 'user_123',
        organizationId: 'org_456',
        permission: OrganizationPermission.MEMBERS_DELETE,
        reason: 'Insufficient role level',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'authz.permission.denied',
          category: EventCategory.AUTHORIZATION,
          severity: EventSeverity.WARNING,
        }),
        undefined
      );
    });

    it('should log role assignment', async () => {
      await integration.logRoleAssignment({
        userId: 'user_123',
        targetUserId: 'user_456',
        organizationId: 'org_789',
        newRole: OrganizationRole.ADMIN,
        oldRole: OrganizationRole.MEMBER,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'authz.role.assigned',
          payload: expect.objectContaining({
            new_role: OrganizationRole.ADMIN,
            old_role: OrganizationRole.MEMBER,
          }),
        }),
        undefined
      );
    });
  });

  describe('Organization Logging', () => {
    it('should log organization created', async () => {
      await integration.logOrganization({
        type: 'created',
        userId: 'user_123',
        organizationId: 'org_456',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'org.created',
          category: EventCategory.ORGANIZATION,
        }),
        undefined
      );
    });

    it('should log organization updated with changes', async () => {
      await integration.logOrganization({
        type: 'updated',
        userId: 'user_123',
        organizationId: 'org_456',
        changes: {
          name: 'New Name',
          settings: { feature_x: true },
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'org.updated',
          payload: expect.objectContaining({
            changes: expect.objectContaining({
              name: 'New Name',
            }),
          }),
        }),
        undefined
      );
    });
  });

  describe('Member Logging', () => {
    it('should log member invited', async () => {
      await integration.logMember({
        type: 'invited',
        userId: 'user_123',
        targetUserId: 'user_456',
        organizationId: 'org_789',
        role: OrganizationRole.MEMBER,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'member.invited',
          category: EventCategory.MEMBER,
        }),
        undefined
      );
    });

    it('should log member removed', async () => {
      await integration.logMember({
        type: 'removed',
        userId: 'user_123',
        targetUserId: 'user_456',
        organizationId: 'org_789',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'member.removed',
        }),
        undefined
      );
    });
  });

  describe('Security Logging', () => {
    it('should log suspicious activity', async () => {
      await integration.logSecurity({
        type: 'suspicious_activity',
        userId: 'user_123',
        description: 'Multiple failed login attempts',
        metadata: { attempts: 10 },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'security.suspicious_activity',
          category: EventCategory.SECURITY,
          severity: EventSeverity.CRITICAL,
        }),
        undefined
      );
    });

    it('should log rate limit exceeded', async () => {
      await integration.logSecurity({
        type: 'rate_limit',
        description: 'API rate limit exceeded',
        severity: EventSeverity.WARNING,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'security.rate_limit.exceeded',
          severity: EventSeverity.WARNING,
        }),
        undefined
      );
    });
  });

  describe('Express Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        ip: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-request-id': 'req_123',
        },
        method: 'GET',
        path: '/api/projects',
        userId: 'user_123',
      };

      mockRes = {
        send: jest.fn().mockReturnThis(),
        statusCode: 200,
      };

      mockNext = jest.fn();
    });

    describe('Request Logging Middleware', () => {
      it('should create request logging middleware', () => {
        const middleware = integration.createRequestLoggingMiddleware();
        expect(typeof middleware).toBe('function');
      });

      it('should log request after response', async () => {
        const middleware = integration.createRequestLoggingMiddleware();

        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();

        // Simulate response
        const originalSend = mockRes.send as jest.Mock;
        mockRes.statusCode = 200;
        originalSend({ data: 'test' });

        // Wait for async logging
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockAuditService.log).toHaveBeenCalled();
      });
    });

    describe('Auth Logging Middleware', () => {
      it('should create login middleware', () => {
        const middleware = integration.createAuthLoggingMiddleware('login');
        expect(typeof middleware).toBe('function');
      });

      it('should log successful login', async () => {
        const middleware = integration.createAuthLoggingMiddleware('login');

        mockReq.body = { email: 'user@example.com', method: 'password' };
        mockRes.statusCode = 200;

        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();

        // Simulate response
        const originalSend = mockRes.send as jest.Mock;
        originalSend({ success: true });

        // Wait for async logging
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.login.success',
          }),
          expect.anything()
        );
      });

      it('should log failed login', async () => {
        const middleware = integration.createAuthLoggingMiddleware('login');

        mockReq.body = { email: 'user@example.com' };
        mockRes.statusCode = 401;

        middleware(mockReq as Request, mockRes as Response, mockNext);

        // Simulate response
        const originalSend = mockRes.send as jest.Mock;
        originalSend({ error: 'Invalid credentials' });

        // Wait for async logging
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'auth.login.failure',
          }),
          expect.anything()
        );
      });
    });

    describe('RBAC Logging Middleware', () => {
      it('should create RBAC middleware', () => {
        const middleware = integration.createRBACLoggingMiddleware();
        expect(typeof middleware).toBe('function');
      });

      it('should log permission check', async () => {
        const middleware = integration.createRBACLoggingMiddleware();

        mockReq.organizationId = 'org_123';
        mockReq.organizationPermissions = [OrganizationPermission.PROJECTS_READ];
        mockReq.organizationRole = OrganizationRole.MEMBER;

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'authz.permission.granted',
          }),
          expect.anything()
        );
      });
    });
  });

  describe('Category Management', () => {
    it('should enable event category', () => {
      integration.disableCategory(EventCategory.SYSTEM);
      expect(integration.isCategoryEnabled(EventCategory.SYSTEM)).toBe(false);

      integration.enableCategory(EventCategory.SYSTEM);
      expect(integration.isCategoryEnabled(EventCategory.SYSTEM)).toBe(true);
    });

    it('should disable event category', () => {
      integration.disableCategory(EventCategory.AUTHENTICATION);
      expect(integration.isCategoryEnabled(EventCategory.AUTHENTICATION)).toBe(false);
    });

    it('should not log disabled categories', async () => {
      integration.disableCategory(EventCategory.AUTHENTICATION);

      await integration.logAuthentication({
        type: 'login_success',
        userId: 'user_123',
      });

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('Request Context Extraction', () => {
    it('should extract context from Express request', async () => {
      const mockReq = {
        ip: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-request-id': 'req_123',
          'x-forwarded-for': '10.0.0.1',
        },
        method: 'POST',
        path: '/api/projects',
      };

      await integration.logAuthentication({
        type: 'login_success',
        userId: 'user_123',
        req: mockReq as any,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          request: mockReq,
        })
      );
    });
  });
});
