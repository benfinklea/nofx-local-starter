---
name: refactor
description: Systematically refactor code with safety checks and incremental improvements
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CODEBASE REFACTORING**
Analyzing entire project for refactoring opportunities...
{{else}}
**Mode: RECENT CHANGES ONLY**
Focusing on recently modified code in the current session. I will:
1. Refactor files modified in the last commit or staging area
2. Improve code you've recently shown me or discussed
3. Focus on the current working context

To refactor the entire codebase instead, use: `/refactor --all`
{{/if}}

Perform systematic code refactoring with safety guarantees and incremental improvements:

## Refactoring Analysis

### 1. Code Smell Detection
**Identify and fix:**
- Long methods (> 20 lines) - Extract into smaller, focused functions
- Large classes (> 300 lines) - Split responsibilities using Single Responsibility Principle
- Long parameter lists (> 3 params) - Use parameter objects or builders
- Duplicate code - Extract common functionality into shared modules
- Dead code - Remove unused variables, functions, and imports
- Complex conditionals - Replace with guard clauses or strategy pattern
- Primitive obsession - Create domain objects for business concepts
- Feature envy - Move methods to classes they primarily interact with
- Data clumps - Group related parameters into objects
- Message chains - Apply Law of Demeter

### 2. Design Pattern Application
**Apply appropriate patterns:**
- **Creational**: Factory, Builder, Singleton (sparingly), Prototype
- **Structural**: Adapter, Decorator, Facade, Proxy, Composite
- **Behavioral**: Strategy, Observer, Command, Iterator, Template Method
- **Domain**: Repository, Service Layer, Value Object, Domain Event
- **Architecture**: MVC, MVP, MVVM, Clean Architecture layers

### 3. SOLID Principles Enforcement
- **Single Responsibility**: One reason to change per class
- **Open/Closed**: Extend behavior without modification
- **Liskov Substitution**: Subtypes replaceable without breaking
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

## Refactoring Strategy

### Safe Refactoring Process
1. **Create comprehensive tests** before any changes
2. **Make ONE small change** at a time
3. **Run tests** after each change
4. **Commit** after each successful refactoring
5. **Review** the cumulative impact
6. **Document** significant architectural changes

### Incremental Improvements
**Phase 1: Quick Wins**
- Remove dead code and unused imports
- Fix naming conventions and typos
- Extract magic numbers to constants
- Simplify boolean expressions
- Remove unnecessary comments

**Phase 2: Structure**
- Extract methods from long functions
- Create helper/utility modules
- Group related functionality
- Introduce parameter objects
- Apply consistent error handling

**Phase 3: Architecture**
- Separate concerns into layers
- Introduce abstractions/interfaces
- Apply dependency injection
- Implement design patterns
- Create domain models

**Phase 4: Optimization**
- Eliminate N+1 queries
- Add caching layers
- Optimize algorithms
- Reduce coupling
- Improve cohesion

## Specific Refactoring Techniques

### Method Extraction
```javascript
// Before
function processOrder(order) {
  // Validate order
  if (!order.items || order.items.length === 0) {
    throw new Error('Order must have items');
  }
  if (order.total < 0) {
    throw new Error('Invalid total');
  }
  
  // Calculate tax
  let tax = 0;
  if (order.state === 'CA') {
    tax = order.subtotal * 0.0725;
  } else if (order.state === 'NY') {
    tax = order.subtotal * 0.08;
  }
  
  // Apply discount
  let discount = 0;
  if (order.coupon) {
    if (order.coupon.type === 'percentage') {
      discount = order.subtotal * order.coupon.value;
    } else {
      discount = order.coupon.value;
    }
  }
  
  // Process payment
  // ... more code
}

// After
function processOrder(order) {
  validateOrder(order);
  const tax = calculateTax(order);
  const discount = applyDiscount(order);
  return processPayment(order, tax, discount);
}

function validateOrder(order) {
  if (!order.items?.length) {
    throw new Error('Order must have items');
  }
  if (order.total < 0) {
    throw new Error('Invalid total');
  }
}

function calculateTax(order) {
  const taxRates = {
    'CA': 0.0725,
    'NY': 0.08
  };
  return order.subtotal * (taxRates[order.state] || 0);
}

function applyDiscount(order) {
  if (!order.coupon) return 0;
  return order.coupon.type === 'percentage' 
    ? order.subtotal * order.coupon.value
    : order.coupon.value;
}
```

### Class Extraction
- Identify cohesive groups of data and behavior
- Create new classes with clear responsibilities
- Move related methods and properties
- Update references throughout codebase
- Add proper encapsulation

### Interface Introduction
- Define contracts for external dependencies
- Create abstractions for third-party libraries
- Enable dependency injection
- Improve testability with mocks
- Reduce coupling between modules

## Performance-Safe Refactoring

### Measure Before and After
- Benchmark critical paths
- Profile memory usage
- Monitor database queries
- Track API response times
- Validate no performance regression

### Optimization Refactoring
- Replace loops with functional methods where appropriate
- Memoize expensive computations
- Lazy load heavy dependencies
- Implement pagination for large datasets
- Use database indices effectively

## Database Refactoring

### Schema Evolution
- Add backwards-compatible changes first
- Migrate data incrementally
- Maintain compatibility period
- Remove deprecated columns/tables last
- Version database schemas

### Query Optimization
- Eliminate N+1 queries with eager loading
- Add appropriate indexes
- Denormalize for read performance
- Use materialized views for complex aggregations
- Implement query result caching

## API Refactoring

### Versioning Strategy
- Maintain backward compatibility
- Deprecate endpoints gracefully
- Provide migration guides
- Use semantic versioning
- Support multiple versions temporarily

### Contract Evolution
- Add optional fields only
- Never remove required fields in same version
- Provide sensible defaults
- Document all changes
- Test with existing clients

## Testing During Refactoring

### Test Coverage Requirements
- Maintain or improve coverage
- Add characterization tests for legacy code
- Create integration tests for major changes
- Verify behavior preservation
- Test edge cases thoroughly

### Regression Prevention
- Run full test suite after each change
- Use mutation testing to verify test quality
- Monitor production metrics
- Implement feature flags for risky changes
- Have rollback plan ready

## Documentation Updates

### Code Documentation
- Update inline comments
- Revise method/class documentation
- Document architectural decisions
- Update README files
- Create migration guides

### Architecture Documentation
- Update system diagrams
- Document new patterns used
- Explain refactoring rationale
- Record technical debt addressed
- Plan future improvements

## Success Metrics

### Code Quality Metrics
- Reduced cyclomatic complexity
- Improved code coverage
- Lower coupling metrics
- Higher cohesion scores
- Fewer code smells

### Business Metrics
- No functionality regression
- Improved performance
- Easier feature additions
- Reduced bug frequency
- Faster development velocity

Begin systematic refactoring now, ensuring each change is safe, tested, and improves code quality.

## Command Completion

✅ `/refactor $ARGUMENTS` command complete.

Summary: Systematically refactored code with safety checks, improved design patterns, and enhanced maintainability.