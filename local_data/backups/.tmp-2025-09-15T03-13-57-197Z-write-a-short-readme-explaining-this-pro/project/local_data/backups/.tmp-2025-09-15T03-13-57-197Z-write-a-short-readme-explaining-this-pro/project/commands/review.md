---
name: review
description: Comprehensive code review with actionable feedback and quality assessment
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CODEBASE REVIEW**
Reviewing entire codebase for quality, security, and best practices...
{{else}}
**Mode: RECENT CHANGES REVIEW**
Focusing on recently modified code in the current session. I will:
1. Review files in the current changeset or staging area
2. Analyze code you've recently shown me or discussed
3. Focus on pull request changes if applicable

To review the entire codebase instead, use: `/review --all`
{{/if}}

Perform thorough code review with focus on quality, maintainability, security, and best practices:

## Code Review Checklist

### 1. Functionality Review
**Core Requirements:**
- [ ] Code accomplishes intended purpose
- [ ] All acceptance criteria met
- [ ] Edge cases handled properly
- [ ] Error scenarios addressed
- [ ] Backwards compatibility maintained
- [ ] Feature flags implemented if needed
- [ ] Performance requirements met
- [ ] Security requirements satisfied

### 2. Code Quality Assessment

**Readability Score (1-10):**
```javascript
// Poor Readability (Score: 3/10)
function p(d,u){let r=[];for(let i=0;i<d.length;i++){if(d[i].t>u){r.push(d[i])}}return r}

// Excellent Readability (Score: 9/10)
function filterRecentPosts(posts, timestamp) {
  return posts.filter(post => post.publishedAt > timestamp);
}
```

**Naming Conventions:**
- Variables: Descriptive, camelCase, meaningful
- Functions: Verb-based, action-oriented
- Classes: PascalCase, noun-based
- Constants: UPPER_SNAKE_CASE
- Files: Consistent with project convention
- No abbreviations unless widely understood

**Code Structure:**
- Single Responsibility Principle followed
- Functions under 20 lines ideally
- Classes under 300 lines ideally
- Cyclomatic complexity < 10
- Nesting depth < 4 levels
- DRY principle applied appropriately

### 3. Architecture Review

**Design Patterns:**
- Appropriate pattern selection
- Correct implementation
- Not over-engineered
- Consistent with codebase
- Well-documented decisions

**Dependency Management:**
- Minimal coupling between modules
- Clear dependency injection
- No circular dependencies
- Appropriate abstraction levels
- External dependencies justified

**Scalability Considerations:**
- Handles increased load gracefully
- Database queries optimized
- Caching strategy appropriate
- Async operations properly managed
- Resource limits considered

### 4. Security Review

**Critical Security Checks:**
```javascript
// SECURITY ISSUES TO FLAG:

// 1. SQL Injection Risk
// BAD:
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD:
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// 2. XSS Vulnerability
// BAD:
element.innerHTML = userInput;

// GOOD:
element.textContent = userInput;

// 3. Sensitive Data Exposure
// BAD:
console.log('User password:', password);

// GOOD:
console.log('User authenticated successfully');

// 4. Insecure Direct Object References
// BAD:
app.get('/file/:filename', (req, res) => {
  res.sendFile(req.params.filename);
});

// GOOD:
app.get('/file/:id', (req, res) => {
  const file = authorizedFiles.get(req.params.id);
  if (file && userCanAccess(req.user, file)) {
    res.sendFile(file.path);
  }
});
```

**Security Checklist:**
- [ ] Input validation implemented
- [ ] Output encoding applied
- [ ] Authentication checks present
- [ ] Authorization verified
- [ ] Sensitive data encrypted
- [ ] HTTPS enforced
- [ ] CSRF protection enabled
- [ ] Rate limiting implemented
- [ ] Secrets not hardcoded
- [ ] Dependencies up to date

### 5. Testing Review

**Test Coverage Analysis:**
- Unit test coverage > 80%
- Critical paths 100% covered
- Edge cases tested
- Error conditions tested
- Mocks used appropriately
- Tests are deterministic
- Test names descriptive
- No skipped tests without justification

**Test Quality:**
```javascript
// Poor Test
test('it works', () => {
  const result = someFunction();
  expect(result).toBeTruthy();
});

// Good Test
describe('UserValidator', () => {
  describe('validateEmail', () => {
    test('should return true for valid email format', () => {
      const validEmail = 'user@example.com';
      expect(UserValidator.validateEmail(validEmail)).toBe(true);
    });
    
    test('should return false for invalid email without @', () => {
      const invalidEmail = 'userexample.com';
      expect(UserValidator.validateEmail(invalidEmail)).toBe(false);
    });
    
    test('should return false for empty string', () => {
      expect(UserValidator.validateEmail('')).toBe(false);
    });
  });
});
```

### 6. Performance Review

**Performance Indicators:**
- [ ] No N+1 queries
- [ ] Appropriate indexes used
- [ ] Lazy loading implemented
- [ ] Pagination for large datasets
- [ ] Caching utilized effectively
- [ ] No blocking operations
- [ ] Memory leaks prevented
- [ ] Bundle size optimized

**Algorithm Complexity:**
- Time complexity analyzed
- Space complexity considered
- Better alternatives suggested
- Bottlenecks identified
- Optimization opportunities noted

### 7. Documentation Review

**Code Documentation:**
```javascript
/**
 * Calculates compound interest with monthly contributions
 * @param {number} principal - Initial investment amount
 * @param {number} rate - Annual interest rate (as decimal, e.g., 0.05 for 5%)
 * @param {number} time - Investment period in years
 * @param {number} contribution - Monthly contribution amount
 * @returns {Object} Object containing total value and interest earned
 * @throws {Error} If any parameter is negative
 * @example
 * calculateCompoundInterest(10000, 0.05, 10, 100)
 * // Returns: { totalValue: 27628.16, interestEarned: 5628.16 }
 */
function calculateCompoundInterest(principal, rate, time, contribution) {
  // Implementation
}
```

**Documentation Checklist:**
- [ ] README updated if needed
- [ ] API documentation current
- [ ] Complex logic explained
- [ ] Configuration documented
- [ ] Migration guide provided
- [ ] Changelog updated
- [ ] Examples provided
- [ ] Error codes documented

### 8. Maintainability Review

**Code Metrics:**
- **Maintainability Index**: > 70 (Good)
- **Technical Debt Ratio**: < 5%
- **Code Duplication**: < 3%
- **Cognitive Complexity**: < 15
- **Lines per Function**: < 50
- **Parameters per Function**: < 4

**Refactoring Suggestions:**
- Extract complex conditions into named functions
- Replace magic numbers with constants
- Introduce intermediate variables for clarity
- Split large functions into smaller ones
- Create helper functions for repeated logic
- Use composition over inheritance

## Review Feedback Format

### Severity Levels

**🔴 BLOCKER** - Must fix before merge
- Security vulnerabilities
- Data loss risks
- Breaking changes
- Critical bugs

**🟡 MAJOR** - Should fix before merge
- Performance issues
- Missing tests
- Code quality problems
- Documentation gaps

**🟢 MINOR** - Can fix in follow-up
- Style inconsistencies
- Minor optimizations
- Nice-to-have features
- Non-critical improvements

**💡 SUGGESTION** - Optional improvements
- Alternative approaches
- Future considerations
- Learning opportunities
- Best practices

### Feedback Template

```markdown
## Code Review Summary

**Overall Assessment**: ⭐⭐⭐⭐☆ (4/5)

### Strengths ✅
- Clean, readable code structure
- Good test coverage (92%)
- Effective error handling
- Well-documented API changes

### Areas for Improvement 🔧

#### 🔴 BLOCKER: SQL Injection Vulnerability
**File**: `src/controllers/user.js:45`
**Issue**: Direct string concatenation in SQL query
**Impact**: High security risk
**Solution**:
\`\`\`javascript
// Current (vulnerable)
const query = \`SELECT * FROM users WHERE email = '\${email}'\`;

// Recommended (safe)
const query = 'SELECT * FROM users WHERE email = ?';
db.query(query, [email]);
\`\`\`

#### 🟡 MAJOR: Missing Error Handling
**File**: `src/services/payment.js:78`
**Issue**: Async operation without try-catch
**Impact**: Unhandled promise rejection
**Solution**: Wrap in try-catch with proper error logging

#### 🟢 MINOR: Inconsistent Naming
**File**: `src/utils/helpers.js:23`
**Issue**: Function uses snake_case instead of camelCase
**Solution**: Rename `get_user_data` to `getUserData`

#### 💡 SUGGESTION: Performance Optimization
**File**: `src/components/List.jsx:156`
**Observation**: Could benefit from memoization
**Suggestion**: Consider using React.memo for expensive renders

### Metrics 📊
- **Files Changed**: 12
- **Lines Added**: 487
- **Lines Removed**: 123
- **Test Coverage**: 92% (+3%)
- **Code Complexity**: 8.2 (Acceptable)
- **Duplication**: 2.1% (Good)

### Action Items 📋
1. Fix SQL injection vulnerability [REQUIRED]
2. Add error handling for payment service [REQUIRED]
3. Update naming conventions [RECOMMENDED]
4. Consider performance optimizations [OPTIONAL]

### Additional Notes
- Consider adding integration tests for the new payment flow
- Update API documentation with new endpoints
- Schedule follow-up for performance monitoring
```

## Automated Checks Integration

### Pre-Review Automation
```bash
# Run before manual review
npm run lint           # Code style
npm run typecheck      # Type safety
npm run test          # Test suite
npm run test:coverage # Coverage report
npm run security:scan # Vulnerability scan
npm run build         # Build verification
```

### Review Tools Configuration
- ESLint for JavaScript/TypeScript
- Prettier for formatting
- SonarQube for code quality
- Snyk for dependency scanning
- Bundle analyzer for size
- Lighthouse for performance

## Review Best Practices

### For Reviewers
1. **Be Constructive**: Provide solutions, not just problems
2. **Be Specific**: Reference exact lines and files
3. **Be Timely**: Review within 24 hours
4. **Be Thorough**: Don't just skim, understand the changes
5. **Be Educational**: Share knowledge and best practices
6. **Be Empathetic**: Remember there's a person behind the code

### For Authors
1. **Self-Review First**: Check your own code
2. **Small PRs**: Keep changes focused and manageable
3. **Clear Description**: Explain what and why
4. **Respond Promptly**: Address feedback quickly
5. **Test Thoroughly**: Don't rely on reviewers to find bugs
6. **Learn from Feedback**: Improve based on reviews

## Post-Review Actions

### After Approval
- [ ] All feedback addressed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Deployment notes prepared
- [ ] Monitoring configured
- [ ] Feature flags set
- [ ] Rollback plan ready

Perform comprehensive code review now, provide detailed feedback with severity levels, and suggest improvements.

## Command Completion

✅ `/review $ARGUMENTS` command complete.

Summary: Completed comprehensive code review with quality assessment, security validation, and actionable improvement recommendations.