# Testing Prompt 6: Webhook & Billing System Testing Suite

## Priority: HIGH 🟠
**Estimated Time:** 5 hours
**Coverage Target:** 95% for billing and webhook systems

## Objective
Implement comprehensive test coverage for Stripe billing integration, webhook handlers, subscription management, and payment processing. These systems handle critical financial operations and must be thoroughly tested for accuracy and security.

## Files to Test

### Billing Core
- `src/billing/stripe.ts` (Tested → 95%)
- `src/billing/stripe/CustomerManagementService.ts` (0% → 95%)
- `src/billing/stripe/SubscriptionManagementService.ts` (0% → 95%)
- `src/billing/stripe/PriceManagementService.ts` (0% → 90%)
- `src/billing/stripe/ProductManagementService.ts` (0% → 90%)
- `src/billing/stripe/SessionManagementService.ts` (0% → 90%)
- `src/billing/stripe/DateUtilityService.ts` (0% → 85%)

### Webhook Handlers
- `src/api/routes/webhooks.ts` (Modified → 90%)
- `src/api/routes/webhooks/WebhookValidationService.ts` (0% → 95%)
- `src/api/routes/webhooks/CustomerEventService.ts` (0% → 90%)
- `src/api/routes/webhooks/SubscriptionEventService.ts` (0% → 95%)
- `src/api/routes/webhooks/InvoiceEventService.ts` (0% → 90%)
- `src/api/routes/webhooks/ProductEventService.ts` (0% → 85%)
- `src/api/routes/webhooks/EmailNotificationService.ts` (0% → 85%)

### API Routes
- `src/api/routes/billing.ts` (0% → 90%)

## Testing Framework & Tools

### Primary Testing Framework: Jest
All tests MUST be written using Jest with proper async handling for webhook and payment operations.

### Using the test-generator Subagent
Leverage the test-generator for complex billing scenarios:
```bash
# Generate webhook handler tests
/test-generator "Create comprehensive tests for Stripe webhook handlers with signature validation"

# Generate subscription lifecycle tests
/test-generator "Generate tests for complete subscription lifecycle: trial, active, canceled, resumed"

# Create payment scenario tests
/test-generator "Create tests for payment processing including failures, retries, and disputes"
```

The test-generator subagent will:
- Generate Stripe event fixtures
- Create webhook signature mocks
- Build subscription state machines
- Generate idempotency test cases
- Create payment failure scenarios

### Required Testing Tools
- **Jest**: Primary framework
- **stripe-mock**: Mock Stripe API
- **jest-date-mock**: Date manipulation for subscriptions
- **nock**: HTTP request mocking
- **crypto**: Webhook signature generation

## Test Requirements

### 1. Unit Tests - Customer Management
```typescript
// CustomerManagementService tests with Jest:
describe('CustomerManagementService', () => {
  let service: CustomerManagementService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    mockStripe = createMockStripe();
    service = new CustomerManagementService(mockStripe);
  });

  describe('createCustomer', () => {
    test('creates customer with metadata', async () => {
      const customerData = {
        email: 'test@example.com',
        metadata: { userId: 'user_123' }
      };

      mockStripe.customers.create.mockResolvedValue(
        createMockCustomer(customerData)
      );

      const customer = await service.createCustomer(customerData);

      expect(customer.email).toBe('test@example.com');
      expect(customer.metadata.userId).toBe('user_123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          metadata: expect.objectContaining({ userId: 'user_123' })
        })
      );
    });

    test('handles duplicate customer creation', async () => {
      // Test idempotent customer creation
    });
  });

  // Additional test scenarios:
  // - Customer updates with validation
  // - Customer deletion and data cleanup
  // - Payment method attachment
  // - Default payment method setting
  // - Customer portal session creation
  // - Tax ID validation
  // - Address verification
  // - Customer search functionality
});
```

### 2. Unit Tests - Subscription Management
```typescript
describe('SubscriptionManagementService', () => {
  let service: SubscriptionManagementService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStripe = createMockStripe();
    service = new SubscriptionManagementService(mockStripe);
  });

  describe('subscription lifecycle', () => {
    test('creates trial subscription', async () => {
      const subscription = await service.createSubscription({
        customerId: 'cus_123',
        priceId: 'price_123',
        trialDays: 14
      });

      expect(subscription.status).toBe('trialing');
      expect(subscription.trial_end).toBeDefined();
    });

    test('handles subscription upgrades', async () => {
      const result = await service.upgradeSubscription(
        'sub_123',
        'price_premium'
      );

      expect(result.proration_behavior).toBe('always_invoice');
    });

    test('processes subscription cancellation', async () => {
      const result = await service.cancelSubscription('sub_123', {
        at_period_end: true,
        cancellation_reason: 'customer_request'
      });

      expect(result.cancel_at_period_end).toBe(true);
    });
  });

  // Additional scenarios:
  // - Subscription pause and resume
  // - Metered billing updates
  // - Discount application
  // - Trial extension
  // - Payment retry logic
  // - Subscription schedule creation
  // - Multiple subscriptions per customer
  // - Proration calculations
  // - Subscription item quantity updates
});
```

### 3. Integration Tests - Webhook Processing
```typescript
describe('Webhook Handler Integration', () => {
  let app: Express;
  let webhookSecret: string;

  beforeAll(() => {
    webhookSecret = 'whsec_test_secret';
    app = createTestApp({ webhookSecret });
  });

  describe('webhook signature validation', () => {
    test('accepts valid webhook signature', async () => {
      const payload = JSON.stringify({
        type: 'customer.subscription.created',
        data: { object: createMockSubscription() }
      });

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('rejects invalid signature', async () => {
      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('signature');
    });
  });

  // Additional webhook tests:
  // - Event replay handling (idempotency)
  // - Event ordering and sequencing
  // - Concurrent webhook processing
  // - Webhook retry on failure
  // - Dead letter queue for failed events
  // - Event type routing
  // - Webhook timeout handling
  // - Rate limiting
});
```

### 4. Unit Tests - Invoice Event Processing
```typescript
describe('InvoiceEventService', () => {
  let service: InvoiceEventService;

  describe('invoice event handling', () => {
    test('processes invoice.payment_succeeded', async () => {
      const event = createStripeEvent('invoice.payment_succeeded', {
        amount_paid: 2999,
        subscription: 'sub_123',
        customer: 'cus_123'
      });

      await service.handleEvent(event);

      // Verify side effects
      const subscription = await getSubscription('sub_123');
      expect(subscription.lastPaymentDate).toEqual(event.created);
      expect(subscription.status).toBe('active');
    });

    test('handles invoice.payment_failed', async () => {
      const event = createStripeEvent('invoice.payment_failed', {
        attempt_count: 3,
        next_payment_attempt: Date.now() + 86400000
      });

      await service.handleEvent(event);

      // Verify retry scheduled
      const retryJob = await getRetryJob(event.data.object.id);
      expect(retryJob).toBeDefined();
      expect(retryJob.attemptCount).toBe(3);
    });
  });

  // Additional invoice scenarios:
  // - Invoice finalization
  // - Invoice voiding
  // - Credit note application
  // - Tax calculation
  // - Currency conversion
  // - Invoice item adjustments
  // - Payment method failures
  // - Dunning management
});
```

### 5. Unit Tests - Webhook Validation
```typescript
describe('WebhookValidationService', () => {
  let service: WebhookValidationService;

  test('validates timestamp within tolerance', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const isValid = service.validateTimestamp(timestamp);

    expect(isValid).toBe(true);
  });

  test('rejects old timestamps', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds old
    const isValid = service.validateTimestamp(oldTimestamp);

    expect(isValid).toBe(false);
  });

  test('computes correct signature', () => {
    const payload = '{"test": "data"}';
    const secret = 'whsec_test';
    const timestamp = '1234567890';

    const signature = service.computeSignature(payload, secret, timestamp);

    expect(signature).toMatch(/^v1=[a-f0-9]{64}$/);
  });
});
```

### 6. End-to-End Tests - Payment Flow
```typescript
describe('E2E Payment Flow', () => {
  test('complete payment journey', async () => {
    // 1. Create customer
    const customer = await createCustomer({
      email: 'e2e@test.com'
    });

    // 2. Create subscription
    const subscription = await createSubscription({
      customer: customer.id,
      items: [{ price: 'price_monthly' }]
    });

    // 3. Simulate payment
    const payment = await processPayment({
      amount: 2999,
      customer: customer.id
    });

    // 4. Verify webhook received
    await waitForWebhook('payment_intent.succeeded');

    // 5. Check subscription status
    const updatedSub = await getSubscription(subscription.id);
    expect(updatedSub.status).toBe('active');

    // 6. Verify invoice generated
    const invoice = await getLatestInvoice(customer.id);
    expect(invoice.status).toBe('paid');
  });
});
```

## Edge Cases to Test

1. **Payment Edge Cases**
   - Insufficient funds
   - Card expiration during subscription
   - 3D Secure authentication
   - Currency mismatch
   - Partial payments
   - Disputed charges
   - Refund processing

2. **Subscription Edge Cases**
   - Mid-cycle plan changes
   - Backdated subscriptions
   - Future-dated cancellations
   - Trial overlap
   - Multiple subscription conflicts
   - Quantity changes at boundaries

3. **Webhook Edge Cases**
   - Out-of-order event delivery
   - Duplicate event delivery
   - Network timeout during processing
   - Partial event processing failure
   - Clock skew between systems

4. **Billing Edge Cases**
   - Proration edge cases
   - Tax calculation failures
   - Multi-currency handling
   - Discount stacking
   - Coupon expiration during checkout

## Performance Requirements

- Webhook processing: < 100ms
- Payment creation: < 500ms
- Subscription updates: < 200ms
- Invoice generation: < 1s
- Customer portal load: < 300ms
- Webhook signature validation: < 10ms

## Security Testing

```typescript
describe('Security Tests', () => {
  test('prevents webhook replay attacks', async () => {
    const event = createWebhookEvent();

    // Process first time
    await processWebhook(event);

    // Attempt replay
    await expect(processWebhook(event))
      .rejects.toThrow('Event already processed');
  });

  test('sanitizes customer input', async () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const customer = await createCustomer({
      name: maliciousInput
    });

    expect(customer.name).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('rate limits API requests', async () => {
    const requests = Array(100).fill(null).map(() =>
      createSubscription(testData)
    );

    const results = await Promise.allSettled(requests);
    const rejected = results.filter(r => r.status === 'rejected');

    expect(rejected.length).toBeGreaterThan(0);
  });
});
```

## Expected Outcomes

1. **Payment Accuracy**: 100% accurate payment processing
2. **Webhook Reliability**: 99.99% webhook delivery success
3. **Security**: Zero payment security vulnerabilities
4. **Compliance**: PCI DSS compliance maintained
5. **Performance**: All operations within latency targets

## Validation Checklist

- [ ] All Stripe events handled
- [ ] Idempotency implemented and tested
- [ ] Webhook signatures validated
- [ ] Payment failures handled gracefully
- [ ] Subscription states properly managed
- [ ] Invoice reconciliation verified
- [ ] Tax calculations accurate
- [ ] Refunds processed correctly
- [ ] Audit trail comprehensive
- [ ] Security measures validated

## Jest Testing Best Practices

1. **Mock Stripe Properly**
   ```javascript
   jest.mock('stripe', () => ({
     __esModule: true,
     default: jest.fn(() => ({
       customers: {
         create: jest.fn(),
         update: jest.fn(),
         // ... other methods
       }
     }))
   }));
   ```

2. **Use Test Fixtures**
   ```javascript
   // fixtures/stripe-events.js
   export const customerCreatedEvent = {
     id: 'evt_test',
     type: 'customer.created',
     data: { /* ... */ }
   };
   ```

3. **Test Error Scenarios**
   ```javascript
   test('handles Stripe API errors', async () => {
     mockStripe.customers.create.mockRejectedValue(
       new Stripe.errors.StripeCardError('Card declined')
     );

     await expect(service.createCustomer(data))
       .rejects.toThrow('Card declined');
   });
   ```