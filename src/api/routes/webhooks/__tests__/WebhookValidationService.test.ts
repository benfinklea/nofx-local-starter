/**
 * Comprehensive test suite for WebhookValidationService
 * Coverage target: 95%+
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { WebhookValidationService } from '../WebhookValidationService';

jest.mock('../../../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('WebhookValidationService', () => {
  let service: WebhookValidationService;
  let mockStripe: jest.Mocked<Stripe>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();

    mockStripe = {
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    mockReq = {
      headers: {},
      body: Buffer.from('test-body'),
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    service = new WebhookValidationService(mockStripe);
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('validateWebhook', () => {
    it('should validate webhook with valid signature', () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        object: 'event',
        api_version: '2023-10-16',
        created: 1640995200,
        data: { object: {} as any },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      } as Stripe.Event;

      mockReq.headers = { 'stripe-signature': 'valid_signature' };
      (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toEqual(mockEvent);
      expect(result.error).toBe(false);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockReq.body,
        'valid_signature',
        'whsec_test_secret'
      );
    });

    it('should reject webhook without signature', () => {
      mockReq.headers = {};

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toBeNull();
      expect(result.error).toBe(true);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing signature' });
    });

    it('should reject webhook when webhook secret not configured', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      mockReq.headers = { 'stripe-signature': 'valid_signature' };

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toBeNull();
      expect(result.error).toBe(true);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Webhook secret not configured' });
    });

    it('should reject webhook with invalid signature', () => {
      mockReq.headers = { 'stripe-signature': 'invalid_signature' };
      (mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toBeNull();
      expect(result.error).toBe(true);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Webhook Error: Invalid signature' });
    });

    it('should handle different event types', () => {
      const eventTypes = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
      ];

      eventTypes.forEach((type) => {
        const mockEvent = {
          id: `evt_${type}`,
          type,
          object: 'event',
          api_version: '2023-10-16',
          created: 1640995200,
          data: { object: {} as any },
          livemode: false,
          pending_webhooks: 0,
          request: null,
        } as Stripe.Event;

        mockReq.headers = { 'stripe-signature': 'valid_signature' };
        (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

        const result = service.validateWebhook(mockReq as Request, mockRes as Response);

        expect(result.event?.type).toBe(type);
        expect(result.error).toBe(false);
      });
    });

    it('should handle empty signature header', () => {
      mockReq.headers = { 'stripe-signature': '' };

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toBeNull();
      expect(result.error).toBe(true);
    });

    it('should handle signature verification timeout errors', () => {
      mockReq.headers = { 'stripe-signature': 'valid_signature' };
      (mockStripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Timestamp outside the tolerance zone');
      });

      const result = service.validateWebhook(mockReq as Request, mockRes as Response);

      expect(result.event).toBeNull();
      expect(result.error).toBe(true);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Webhook Error: Timestamp outside the tolerance zone',
      });
    });
  });

  describe('isRelevantEvent', () => {
    it('should return true for product events', () => {
      expect(service.isRelevantEvent('product.created')).toBe(true);
      expect(service.isRelevantEvent('product.updated')).toBe(true);
      expect(service.isRelevantEvent('product.deleted')).toBe(true);
    });

    it('should return true for price events', () => {
      expect(service.isRelevantEvent('price.created')).toBe(true);
      expect(service.isRelevantEvent('price.updated')).toBe(true);
      expect(service.isRelevantEvent('price.deleted')).toBe(true);
    });

    it('should return true for subscription events', () => {
      expect(service.isRelevantEvent('customer.subscription.created')).toBe(true);
      expect(service.isRelevantEvent('customer.subscription.updated')).toBe(true);
      expect(service.isRelevantEvent('customer.subscription.deleted')).toBe(true);
    });

    it('should return true for invoice events', () => {
      expect(service.isRelevantEvent('invoice.payment_succeeded')).toBe(true);
      expect(service.isRelevantEvent('invoice.payment_failed')).toBe(true);
    });

    it('should return true for checkout and customer events', () => {
      expect(service.isRelevantEvent('checkout.session.completed')).toBe(true);
      expect(service.isRelevantEvent('customer.updated')).toBe(true);
    });

    it('should return false for irrelevant events', () => {
      expect(service.isRelevantEvent('charge.succeeded')).toBe(false);
      expect(service.isRelevantEvent('payment_intent.succeeded')).toBe(false);
      expect(service.isRelevantEvent('customer.deleted')).toBe(false);
      expect(service.isRelevantEvent('random.event')).toBe(false);
      expect(service.isRelevantEvent('')).toBe(false);
    });

    it('should handle case-sensitive event names correctly', () => {
      expect(service.isRelevantEvent('PRODUCT.CREATED')).toBe(false);
      expect(service.isRelevantEvent('Product.Created')).toBe(false);
    });

    it('should handle event names with extra spaces', () => {
      expect(service.isRelevantEvent('product.created ')).toBe(false);
      expect(service.isRelevantEvent(' product.created')).toBe(false);
    });

    it('should validate all 13 relevant events', () => {
      const relevantEvents = [
        'product.created',
        'product.updated',
        'product.deleted',
        'price.created',
        'price.updated',
        'price.deleted',
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.updated',
      ];

      relevantEvents.forEach((event) => {
        expect(service.isRelevantEvent(event)).toBe(true);
      });

      expect(relevantEvents.length).toBe(13);
    });
  });
});
