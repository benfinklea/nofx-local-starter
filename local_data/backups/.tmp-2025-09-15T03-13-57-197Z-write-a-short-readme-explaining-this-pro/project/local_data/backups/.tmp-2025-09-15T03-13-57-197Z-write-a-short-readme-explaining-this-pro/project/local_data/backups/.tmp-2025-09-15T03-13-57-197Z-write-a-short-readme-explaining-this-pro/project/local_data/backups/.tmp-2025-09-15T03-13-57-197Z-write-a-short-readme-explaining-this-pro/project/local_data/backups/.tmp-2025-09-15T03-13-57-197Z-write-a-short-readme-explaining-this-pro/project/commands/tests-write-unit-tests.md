---
name: tests-write-unit-tests
description: Write comprehensive unit tests with 100% meaningful coverage
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CODEBASE TEST COVERAGE**
Writing unit tests for all untested code across the entire project...
{{else}}
**Mode: RECENT CODE TESTING**
Focusing on recently modified code. I will:
1. Write tests for functions/classes added or modified recently
2. Cover code you've just written or shown me
3. Focus on untested code in recent commits

To write tests for the entire codebase, use: `/tests-write-unit-tests --all`
{{/if}}

Write comprehensive unit tests for the code with the following requirements:

## Core Testing Principles
- Achieve 100% code coverage through meaningful, valuable tests
- Each test must serve a real purpose in catching potential bugs
- No gaming metrics - every test must validate actual functionality
- Focus on testing behavior, not implementation details

## Test Coverage Requirements

### 1. Happy Path Testing
- Test all successful execution scenarios
- Validate expected outputs for valid inputs
- Verify state changes occur correctly
- Confirm return values match specifications

### 2. Edge Cases
- Test boundary values (min, max, zero, empty)
- Handle null/undefined inputs gracefully
- Test with special characters and Unicode
- Validate array/collection edge cases (empty, single item, many items)

### 3. Error Scenarios
- Test all error conditions and exceptions
- Validate error messages are descriptive
- Ensure proper error propagation
- Test recovery from error states

### 4. Input Validation
- Test with invalid data types
- Validate required vs optional parameters
- Test input sanitization and constraints
- Verify rejection of malformed data

## Test Structure Requirements

### Test Organization
- Use descriptive test names that explain what is being tested
- Group related tests in describe blocks or test suites
- Follow AAA pattern: Arrange, Act, Assert
- Include setup and teardown where needed

### Test Quality
- Each test should test ONE thing
- Tests must be deterministic and repeatable
- Avoid test interdependencies
- Mock external dependencies appropriately
- Use test data builders for complex objects

### Assertions
- Use specific assertions (not just truthy/falsy)
- Test both positive and negative cases
- Verify side effects and state mutations
- Check for proper cleanup after operations

## Implementation Steps

1. **Analyze the code structure** to identify all testable units
2. **Create test file(s)** following project conventions
3. **Write tests for each function/method** covering:
   - Normal operation
   - Edge cases
   - Error conditions
   - State changes
4. **Run tests** and verify 100% coverage
5. **Fix any failing tests** by either:
   - Correcting bugs in the application code
   - Adjusting test expectations if requirements changed
6. **Add regression tests** for any bugs found

## Bug Resolution Protocol
- If a test reveals a bug in the application: FIX THE BUG
- If a test has incorrect expectations: UPDATE THE TEST
- Document any behavioral changes discovered through testing
- Never skip or disable tests to achieve passing status

## Final Validation
- Ensure all tests pass consistently
- Verify coverage report shows 100% for all metrics (statements, branches, functions, lines)
- Confirm tests run quickly (unit tests should be fast)
- Validate that tests actually catch regressions when code is intentionally broken

Write the tests now, execute them, and fix any issues discovered.

## Command Completion

✅ `/tests-write-unit-tests $ARGUMENTS` command complete.

Summary: Written comprehensive unit tests with 100% meaningful coverage, executed test suite, and validated all functionality.