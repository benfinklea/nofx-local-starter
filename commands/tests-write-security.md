---
name: tests-write-security
description: Write security tests to identify vulnerabilities and validate defenses
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL SECURITY AUDIT**
Writing security tests for all endpoints, inputs, and authentication flows...
{{else}}
**Mode: RECENT CODE SECURITY**
Focusing on security of recently modified code. I will:
1. Test security of new endpoints or features
2. Validate authentication/authorization changes
3. Focus on security-sensitive code you've recently added

To write security tests for the entire application, use: `/tests-write-security --all`
{{/if}}

Write comprehensive security tests to identify vulnerabilities and validate security controls:

## Security Testing Objectives

### 1. Authentication & Authorization Tests

**Authentication Security**
- Test password strength requirements
- Validate account lockout after failed attempts
- Test session timeout and invalidation
- Verify secure password reset flow
- Test multi-factor authentication bypasses
- Validate JWT token security and expiration
- Test remember-me functionality security

**Authorization Checks**
- Test privilege escalation attempts
- Verify role-based access controls (RBAC)
- Test direct object reference vulnerabilities
- Validate API endpoint authorization
- Test cross-tenant data isolation
- Verify admin function restrictions
- Test authorization cache poisoning

### 2. Input Validation & Injection Tests

**SQL Injection**
- Test all input fields with SQL payloads
- Validate parameterized queries
- Test second-order SQL injection
- Verify stored procedure security
- Test NoSQL injection vectors
- Validate ORM security

**Cross-Site Scripting (XSS)**
- Test reflected XSS in all inputs
- Test stored XSS in user content
- Test DOM-based XSS vulnerabilities
- Validate Content Security Policy (CSP)
- Test SVG and file upload XSS
- Verify output encoding

**Command Injection**
- Test OS command injection
- Validate shell escape functions
- Test LDAP injection
- Verify XML injection prevention
- Test template injection
- Validate file path traversal protection

### 3. Session Management Tests

**Session Security**
- Test session fixation vulnerabilities
- Validate session regeneration after login
- Test concurrent session handling
- Verify secure cookie attributes
- Test session hijacking prevention
- Validate CSRF token implementation
- Test clickjacking protection

### 4. Data Protection Tests

**Encryption Validation**
- Verify HTTPS enforcement
- Test SSL/TLS configuration
- Validate encryption at rest
- Test key management security
- Verify password hashing algorithms
- Test PII data encryption
- Validate secure data transmission

**Data Leakage Prevention**
- Test error message information disclosure
- Validate debug mode is disabled
- Test source code disclosure
- Verify metadata scrubbing
- Test cache header security
- Validate API response filtering
- Test log file security

### 5. API Security Tests

**API Authentication**
- Test API key security
- Validate OAuth implementation
- Test rate limiting effectiveness
- Verify API versioning security
- Test GraphQL security
- Validate webhook signature verification

**API Vulnerabilities**
- Test mass assignment vulnerabilities
- Validate input size limits
- Test XML/JSON bomb protection
- Verify API method restrictions
- Test CORS configuration
- Validate API error handling

### 6. Business Logic Tests

**Logic Flaws**
- Test race conditions in transactions
- Validate price manipulation prevention
- Test workflow bypass attempts
- Verify time-based attack prevention
- Test quantity manipulation
- Validate discount/coupon abuse prevention

### 7. Infrastructure Security Tests

**Configuration Security**
- Test default credentials
- Validate security headers
- Test directory listing prevention
- Verify backup file access
- Test admin interface exposure
- Validate service version hiding

**Denial of Service**
- Test resource exhaustion attacks
- Validate rate limiting
- Test slowloris attacks
- Verify regex DoS prevention
- Test XML entity expansion limits
- Validate file upload size limits

## Implementation Framework

### Security Test Tools Integration
```javascript
// Example security test structure
const securityTests = {
  owasp: {
    sqlInjection: ['OR 1=1--', "' OR '1'='1", '" OR "1"="1'],
    xssPayloads: ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>'],
    pathTraversal: ['../../../etc/passwd', '..\\..\\..\\windows\\system32\\config\\sam']
  },
  authentication: {
    bruteForce: { attempts: 10, lockoutExpected: true },
    sessionTimeout: { idleTime: '30m', expectedLogout: true },
    tokenValidation: { expired: true, tampered: true, none: true }
  }
};
```

### Vulnerability Scanning

**Automated Scans**
- OWASP Top 10 vulnerability checks
- CVE database validation
- Dependency vulnerability scanning
- Container image scanning
- Infrastructure as Code scanning
- Secret detection in code

**Manual Testing**
- Business logic exploitation
- Chained vulnerability testing
- Social engineering vectors
- Physical security considerations
- Supply chain vulnerabilities

### Compliance Testing

**Regulatory Requirements**
- GDPR data protection validation
- PCI DSS compliance checks
- HIPAA security controls
- SOC 2 requirements
- ISO 27001 controls
- Industry-specific regulations

## Security Test Scenarios

### 1. Attack Simulation
- Simulate authenticated attacker
- Test insider threat scenarios
- Validate external attacker limitations
- Test supply chain attacks
- Simulate data exfiltration
- Test lateral movement prevention

### 2. Penetration Testing
- Black box testing approach
- White box code review
- Gray box hybrid testing
- Red team exercises
- Purple team collaboration
- Blue team response validation

### 3. Incident Response
- Test security monitoring alerts
- Validate incident detection time
- Test automated response actions
- Verify forensic data collection
- Test recovery procedures
- Validate communication protocols

## Reporting Requirements

### Security Report Contents
- Executive summary with risk ratings
- Detailed vulnerability descriptions
- Proof of concept exploits
- CVSS scores for each finding
- Remediation recommendations
- Compliance status summary

### Risk Classification
- Critical: Immediate action required
- High: Fix within 7 days
- Medium: Fix within 30 days
- Low: Fix in next release
- Informational: Best practice recommendations

## Success Criteria
- No critical or high vulnerabilities
- All OWASP Top 10 covered
- Compliance requirements met
- Security headers properly configured
- Encryption properly implemented
- Access controls functioning correctly
- Audit logging comprehensive
- Incident response tested

Write and execute these security tests, identify vulnerabilities, and provide remediation guidance.

## Command Completion

✅ `/tests-write-security $ARGUMENTS` command complete.

Summary: Written comprehensive security tests covering OWASP Top 10, vulnerability scanning, and penetration testing scenarios.