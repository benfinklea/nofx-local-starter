---
name: dependencies-audit
description: Audit dependencies for security, updates, and optimization opportunities
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL DEPENDENCY TREE AUDIT**
Auditing all dependencies including transitive dependencies across the entire project...
{{else}}
**Mode: DIRECT DEPENDENCIES ONLY**
Focusing on direct dependencies and recently added packages. I will:
1. Audit packages added or updated recently
2. Check direct dependencies in package.json/requirements.txt/go.mod
3. Focus on dependencies related to recent code changes

To audit all dependencies including transitive ones, use: `/dependencies-audit --all`
{{/if}}

Perform comprehensive dependency audit for security vulnerabilities, available updates, and optimization opportunities:

## Security Vulnerability Scanning

### Critical Security Checks
**Identify and Fix:**
- Known CVEs in dependencies
- Outdated packages with security patches
- Malicious package detection
- License compliance issues
- Supply chain vulnerabilities
- Dependency confusion attacks
- Typosquatting detection

### Vulnerability Report
```
CRITICAL: 2 vulnerabilities requiring immediate action
HIGH: 5 vulnerabilities to fix within 24 hours  
MEDIUM: 12 vulnerabilities to fix this sprint
LOW: 23 informational issues

Package: lodash@4.17.15
Severity: CRITICAL
CVE: CVE-2021-23337
Impact: Command Injection
Fixed in: 4.17.21
Action: Update immediately

Package: axios@0.21.0  
Severity: HIGH
CVE: CVE-2021-3749
Impact: Regular Expression DoS
Fixed in: 0.21.2
Action: Update within 24 hours
```

## Dependency Updates

### Update Strategy
**Categorize Updates:**
1. **Security Updates** - Apply immediately
2. **Patch Updates** (x.x.1) - Apply after testing
3. **Minor Updates** (x.1.x) - Review changelog, test thoroughly
4. **Major Updates** (1.x.x) - Plan migration, check breaking changes

### Update Impact Analysis
```javascript
// Analyze breaking changes
const updateAnalysis = {
  'react': {
    current: '17.0.2',
    latest: '18.2.0',
    breaking: true,
    changes: [
      'New JSX Transform',
      'Automatic batching',
      'Suspense changes',
      'Strict mode behaviors'
    ],
    effort: 'high',
    benefits: ['Better performance', 'Concurrent features'],
    risks: ['Component compatibility', 'Third-party library support']
  }
};
```

## Dependency Optimization

### Bundle Size Analysis
**Identify Bloat:**
- Find duplicate dependencies
- Detect unnecessary dependencies
- Identify heavy dependencies
- Find lighter alternatives
- Remove unused exports

### Optimization Opportunities
```
Current bundle: 2.4MB
After optimization: 1.6MB (33% reduction)

Replacements:
- moment.js (67KB) → date-fns (12KB)
- lodash (71KB) → lodash-es with tree-shaking (15KB)
- axios (53KB) → native fetch or ky (9KB)

Removals:
- unused-package: Not referenced in code
- dev-dependency-in-prod: Move to devDependencies
```

## License Compliance

### License Analysis
```
License Summary:
- MIT: 423 packages ✓
- Apache-2.0: 89 packages ✓
- BSD-3-Clause: 34 packages ✓
- ISC: 28 packages ✓
- GPL-3.0: 2 packages ⚠️ (copyleft)
- UNLICENSED: 1 package ❌ (review required)

Action Required:
- Review GPL-3.0 packages for compliance
- Replace or get permission for UNLICENSED package
```

## Dependency Health Metrics

### Package Quality Indicators
- Maintenance status (last update)
- Download statistics trend
- Issue resolution time
- Test coverage
- Documentation quality
- Community activity
- Security track record

### Risk Assessment
```
High Risk Packages:
1. abandoned-lib: No updates for 3 years
2. solo-maintainer: Single point of failure
3. no-tests-pkg: Zero test coverage
4. frequent-breaks: History of breaking changes

Recommended Actions:
- Find alternatives for high-risk packages
- Fork and maintain critical abandoned packages
- Contribute to under-maintained dependencies
```

## Automated Audit Pipeline

### CI/CD Integration
```yaml
# GitHub Actions example
name: Dependency Audit
on:
  schedule:
    - cron: '0 0 * * *' # Daily
  pull_request:

jobs:
  audit:
    steps:
      - name: Security Audit
        run: npm audit --audit-level=moderate
      
      - name: License Check
        run: license-checker --failOn 'GPL'
      
      - name: Bundle Size
        run: size-limit
      
      - name: Outdated Check
        run: npm outdated
      
      - name: Dependency Graph
        run: madge --circular src/
```

## Remediation Actions

### Immediate Actions
1. **Fix critical vulnerabilities** with available patches
2. **Remove unused dependencies** to reduce attack surface
3. **Update high-risk packages** to stable versions
4. **Document exceptions** for unfixable issues

### Long-term Strategy
- Establish dependency update policy
- Implement automated security scanning
- Create approved package list
- Regular dependency reviews
- Maintain fork of critical packages

Perform comprehensive dependency audit now, fix vulnerabilities, optimize bundle size, and ensure compliance.

## Command Completion

✅ `/dependencies-audit $ARGUMENTS` command complete.

Summary: Completed dependency audit with security vulnerability fixes, update recommendations, and compliance validation.