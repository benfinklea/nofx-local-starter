# Stripe Billing Test Suite - Regression Prevention System

## Overview

This comprehensive test suite prevents regression in the Stripe billing integration. After experiencing recurring test failures, we've implemented multiple layers of protection to ensure tests remain stable and reliable.

## Problem Statement

The Stripe tests kept failing even after fixes due to:

1. **Mock Structure Issues**: The mock Supabase client didn't properly handle method chaining, causing `mockSupabase.from().upsert()` calls to fail with "toHaveBeenCalledWith is not a function"
2. **Hoisting Problems**: Jest's mock hoisting caused initialization order issues with the Stripe mock
3. **Missing Mock Definitions**: Some Stripe methods (like `subscriptions.cancel`) weren't defined in the mock

## Solution Architecture

### 1. Proper Mock Structure (`stripe.test.ts`)

**Before:**
```javascript
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({...})),
    upsert: jest.fn(() => Promise.resolve({ error: null }))
  }))
};
```

**Problem**: Each call to `from()` returned a new mock instance, but the assertions couldn't track calls properly.

**After:**
```javascript
const createMockSupabase = () => {
  const mockSingle = jest.fn();
  const mockEq = jest.fn();
  const mockSelect = jest.fn();
  const mockUpsert = jest.fn();
  const mockFrom = jest.fn();

  // Proper implementation that maintains references
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
    delete: mockDelete
  }));

  return {
    from: mockFrom,
    _mocks: {
      single: mockSingle,
      eq: mockEq,
      upsert: mockUpsert,
      // ... other mocks
    },
    _reset: resetMocks
  };
};
```

**Benefits**:
- Mock instances are maintained and can be properly asserted
- Direct access to mocks via `mockSupabase._mocks.upsert`
- Reset functionality via `mockSupabase._reset()`

### 2. Stripe Mock Initialization

**Before:**
```javascript
const mockStripeInstance = {...};
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance); // ❌ Hoisting issue
});
```

**After:**
```javascript
jest.mock('stripe', () => {
  const mockInstance = {
    customers: { create: jest.fn(), retrieve: jest.fn() },
    subscriptions: { retrieve: jest.fn(), update: jest.fn(), cancel: jest.fn() },
    // ... complete implementation
  };
  return jest.fn().mockImplementation(() => mockInstance);
});

// Import after mock definition
import { stripe } from '../stripe';
const mockedStripe = stripe as any;
```

**Benefits**:
- Avoids hoisting issues
- All Stripe methods are defined upfront
- Easy to access via `mockedStripe` reference

### 3. Test Infrastructure (`helpers/mockSupabaseClient.ts`)

Provides reusable mock infrastructure:

```typescript
export function createMockSupabaseClient(): MockSupabaseClient
export function resetMockSupabaseClient(client: MockSupabaseClient): void
export class MockSupabaseBuilder {
  mockSelectSingle(data: any): this
  mockUpsertSuccess(data?: any): this
  mockUpdateSuccess(data?: any): this
  // ... fluent API for common patterns
}
```

**Usage**:
```typescript
const mockSupabase = createMockSupabaseClient();
mockSupabase(mockClient)
  .mockSelectSingle({ stripe_customer_id: 'cus_123' })
  .mockUpsertSuccess();
```

### 4. Snapshot System (`helpers/testSnapshot.ts`)

Automatically records test behavior and detects changes:

```typescript
const recorder = new TestSnapshotRecorder('stripe-tests');

// Records all mock calls and assertions
recorder.recordMockCall('test-name', 'functionName', args, returnValue);
recorder.recordAssertion('test-name', 'toBe', expected, actual, passed);

// Compare against saved snapshots
const { matches, differences } = recorder.compareWithSnapshot('test-name');
```

**Benefits**:
- Detects behavioral changes across refactoring
- Creates audit trail of test behavior
- Helps identify root causes of regression

### 5. Contract Tests (`stripe.contract.test.ts`)

Ensures API contracts are maintained:

```typescript
describe('Stripe Integration Contracts', () => {
  it('should verify function signatures have not changed', () => {
    expect(toDateTime.length).toBe(1);
    expect(createOrRetrieveCustomer.length).toBe(2);
  });

  it('should maintain expected data shapes', () => {
    expect(mockProduct).toMatchObject(expectedShape);
  });

  it('should handle errors gracefully', async () => {
    await expect(createOrRetrieveCustomer('invalid')).resolves.not.toThrow();
  });
});
```

**Benefits**:
- Catches breaking changes in API surface
- Validates error handling behavior
- Documents expected contracts

### 6. Pre-Commit Hooks (`.husky/pre-commit`)

Prevents broken tests from being committed:

```bash
#!/usr/bin/env sh
echo "🧪 Running Stripe billing tests..."
npm test -- src/billing/__tests__/stripe.test.ts --passWithNoTests

if [ $? -ne 0 ]; then
  echo "❌ Stripe tests failed! Please fix the tests before committing."
  exit 1
fi
```

**Setup**:
```bash
chmod +x .husky/pre-commit
```

## Test Suite Structure

### Core Tests (`stripe.test.ts`)
- **Date Utilities**: toDateTime, getTrialEnd
- **Customer Management**: createOrRetrieveCustomer, error handling
- **Product Management**: upsertProduct, deleteProduct, error handling
- **Price Management**: upsertPrice, deletePrice, recurring vs one-time
- **Subscription Management**: manageSubscriptionStatusChange, cancel, resume
- **Checkout & Portal**: createCheckoutSession, createPortalSession

**Coverage**: 36 passing tests, 1 skipped (edge case)

### Contract Tests (`stripe.contract.test.ts`)
- **API Structure Contracts**: Function exports, signatures, arity
- **Return Type Contracts**: Type validation, format checking
- **Data Shape Contracts**: Stripe object structures
- **Error Handling Contracts**: Graceful degradation, fallback values
- **Integration Dependencies**: Module requirements

## Running Tests

```bash
# Run full test suite
npm test -- src/billing/__tests__/stripe.test.ts

# Run contract tests
npm test -- src/billing/__tests__/stripe.contract.test.ts

# Run all billing tests
npm test -- src/billing/__tests__/

# Run with coverage
npm test -- src/billing/__tests__/ --coverage

# Watch mode for development
npm test -- src/billing/__tests__/ --watch
```

## Debugging Test Failures

### 1. Mock Call Not Found

**Error**: `expect(jest.fn()).toHaveBeenCalledWith(...expected) Number of calls: 0`

**Solution**:
- Use `mockSupabase._mocks.upsert` instead of `mockSupabase.from().upsert`
- Check that mocks are reset in `beforeEach`: `mockSupabase._reset()`
- Verify mock is set up before the function call

### 2. Wrong Return Value

**Error**: `expect(received).toBe(expected) // Received: undefined`

**Solution**:
- Check mock return values are configured: `mockSingle.mockResolvedValueOnce({...})`
- Ensure `mockResolvedValueOnce` for sequential calls
- Verify the implementation actually uses the mocked path

### 3. Type Errors

**Error**: `Property 'cancel' does not exist on type...`

**Solution**:
- Add missing method to Stripe mock definition
- Use `mockedStripe` reference with proper typing
- Update mock structure in jest.mock('stripe') block

## Best Practices

### ✅ DO

- Reset mocks in `beforeEach` using `mockSupabase._reset()`
- Use `mockResolvedValueOnce` for sequential mock calls
- Access mocks directly via `_mocks` property for assertions
- Add comments explaining complex mock setups
- Run contract tests after refactoring

### ❌ DON'T

- Try to assert on `mockSupabase.from().upsert` - won't work
- Use `jest.doMock` after module import - hoisting issues
- Forget to define all Stripe methods in the mock
- Skip test failures without understanding root cause
- Remove contract tests - they catch regressions

## Maintenance

### Adding New Functions

1. Add to `stripe.ts` exports
2. Add tests to `stripe.test.ts`
3. Add contract test to `stripe.contract.test.ts`
4. Update this README with new coverage

### Refactoring Services

1. Run contract tests BEFORE refactoring
2. Keep same exports from `stripe.ts`
3. Run full test suite DURING refactoring
4. Run contract tests AFTER refactoring
5. Update snapshots if behavior intentionally changed

### Updating Mocks

1. Keep mock structure in sync with services
2. Add new methods to `mockStripeInstance`
3. Add new Supabase methods to `createMockSupabase`
4. Update helper functions in `mockSupabaseClient.ts`

## Troubleshooting

### Tests Pass Locally But Fail in CI

- Check Node version consistency
- Verify all dependencies installed
- Check for timezone-dependent tests
- Review CI environment variables

### Flaky Tests

- Look for asynchronous operations without proper await
- Check for shared state between tests
- Verify mocks are properly reset
- Use `jest.clearAllMocks()` in `beforeEach`

### Performance Issues

- Use `--maxWorkers=50%` for faster parallel execution
- Skip heavy integration tests in watch mode
- Use `test.only` for focused development
- Consider splitting large test files

## Related Documentation

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions)
- [Testing Best Practices](../../../docs/testing.md)
- [CI/CD Pipeline](../../../.github/workflows/test.yml)

## Support

For questions or issues:
1. Check this README first
2. Review test failure logs carefully
3. Check git blame for recent changes
4. Ask in #engineering Slack channel
5. Create issue with test failure details

---

**Last Updated**: {{DATE}}
**Maintained By**: Engineering Team
**Test Status**: ✅ All Passing (36 tests)
