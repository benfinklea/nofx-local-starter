# 🚀 Smoke Testing Guide - NOFX Control Plane

## Overview

Smoke testing ensures critical functionality works after deployments, code changes, or environment updates. This guide implements 2025 best practices for fast, reliable smoke testing using Newman and strategic test selection.

## Smoke Testing Philosophy

> **"Smoke tests are the canary in the coal mine"** - They detect critical failures quickly before comprehensive testing begins.

### Key Principles
1. **Fast Execution** - Complete in under 30 seconds
2. **Critical Path Focus** - Test only essential functionality
3. **Fail Fast** - Stop on first failure to provide immediate feedback
4. **Environment Agnostic** - Run consistently across dev, staging, production
5. **Automated Integration** - Part of every CI/CD pipeline

## Smoke Test Categories

### 🔥 **Tier 1: Critical Infrastructure (5-10 tests)**
**Must pass for system to be considered functional**

1. **Health Check**
   - API responds (`GET /api/health`)
   - Database connectivity
   - Basic service status

2. **Authentication Flow**
   - Admin login works
   - Token generation/validation
   - Basic authorization

3. **Core Run Management**
   - Create simple run (`POST /api/runs`)
   - Retrieve run status (`GET /api/runs/:id`)
   - Basic queue processing

### ⚡ **Tier 2: Essential Features (5-10 tests)**
**Key features users depend on daily**

4. **Project Operations**
   - List projects (`GET /api/projects`)
   - Basic project access

5. **Model Access**
   - Model router availability
   - Provider connectivity (stub mode)

6. **Storage Operations**
   - Basic artifact storage
   - Data persistence

### 🔍 **Tier 3: Supporting Systems (5 tests)**
**Important but not critical for basic functionality**

7. **Queue System**
   - Queue health check
   - Basic job processing

8. **Monitoring Endpoints**
   - Metrics collection
   - Log aggregation

## Implementation Strategy

### Newman Smoke Test Collection

#### Collection Structure
```json
{
  "info": {
    "name": "NOFX Smoke Tests",
    "description": "Critical functionality validation for NOFX Control Plane",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Health Check",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/health"
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('API is healthy', () => {",
            "    pm.response.to.have.status(200);",
            "    pm.expect(pm.response.json().status).to.eql('ok');",
            "});",
            "",
            "pm.test('Response time is acceptable', () => {",
            "    pm.expect(pm.response.responseTime).to.be.below(5000);",
            "});"
          ]
        }
      }]
    },
    {
      "name": "2. Admin Authentication",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/ui/login",
        "body": {
          "mode": "raw",
          "raw": "{\"password\": \"{{adminPassword}}\"}"
        }
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Admin login successful', () => {",
            "    pm.response.to.have.status(200);",
            "});",
            "",
            "pm.test('Admin cookie set', () => {",
            "    pm.expect(pm.cookies.has('admin')).to.be.true;",
            "    pm.globals.set('adminCookie', pm.cookies.get('admin'));",
            "});"
          ]
        }
      }]
    },
    {
      "name": "3. Create Simple Run",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/runs",
        "header": [
          {
            "key": "Cookie",
            "value": "admin={{adminCookie}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{{smokeTestRun}}"
        }
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Run created successfully', () => {",
            "    pm.response.to.have.status(200);",
            "    pm.expect(pm.response.json().success).to.be.true;",
            "});",
            "",
            "pm.test('Run has valid ID', () => {",
            "    const runId = pm.response.json().data.id;",
            "    pm.expect(runId).to.match(/^run_[a-zA-Z0-9]+$/);",
            "    pm.globals.set('smokeRunId', runId);",
            "});"
          ]
        }
      }]
    },
    {
      "name": "4. Verify Run Status",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/runs/{{smokeRunId}}",
        "header": [
          {
            "key": "Cookie",
            "value": "admin={{adminCookie}}"
          }
        ]
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Run status accessible', () => {",
            "    pm.response.to.have.status(200);",
            "    pm.expect(pm.response.json().id).to.eql(pm.globals.get('smokeRunId'));",
            "});",
            "",
            "pm.test('Run has valid status', () => {",
            "    const status = pm.response.json().status;",
            "    pm.expect(['pending', 'running', 'succeeded', 'failed']).to.include(status);",
            "});"
          ]
        }
      }]
    },
    {
      "name": "5. Projects List",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/projects",
        "header": [
          {
            "key": "Cookie",
            "value": "admin={{adminCookie}}"
          }
        ]
      },
      "event": [{
        "listen": "test",
        "script": {
          "exec": [
            "pm.test('Projects endpoint accessible', () => {",
            "    pm.response.to.have.status(200);",
            "    pm.expect(pm.response.json()).to.have.property('projects');",
            "});"
          ]
        }
      }]
    }
  ]
}
```

### Environment Configurations

#### Local Development
```json
{
  "name": "Local Smoke Tests",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "enabled": true
    },
    {
      "key": "adminPassword",
      "value": "admin123",
      "enabled": true
    },
    {
      "key": "smokeTestRun",
      "value": "{\"plan\":{\"goal\":\"Smoke test run\",\"steps\":[{\"name\":\"smoke\",\"tool\":\"codegen\",\"inputs\":{\"prompt\":\"Hello smoke test\"}}]}}",
      "enabled": true
    }
  ]
}
```

#### Production Environment
```json
{
  "name": "Production Smoke Tests",
  "values": [
    {
      "key": "baseUrl",
      "value": "https://nofx-control-plane.vercel.app",
      "enabled": true
    },
    {
      "key": "adminPassword",
      "value": "{{ADMIN_PASSWORD}}",
      "enabled": true
    },
    {
      "key": "smokeTestRun",
      "value": "{\"plan\":{\"goal\":\"Production smoke test\",\"steps\":[{\"name\":\"health-check\",\"tool\":\"codegen\",\"inputs\":{\"prompt\":\"System health check\"}}]}}",
      "enabled": true
    }
  ]
}
```

## Execution Strategies

### Command Line Execution

#### Basic Smoke Test
```bash
# Run local smoke tests
newman run collections/nofx-smoke-tests.json \
  --environment environments/local.json \
  --bail \
  --timeout-request 10000

# Run production health check
newman run collections/nofx-smoke-tests.json \
  --environment environments/production.json \
  --bail \
  --timeout-request 5000 \
  --reporters cli
```

#### CI/CD Integration
```bash
# Fast feedback in CI (fail fast)
newman run collections/nofx-smoke-tests.json \
  --environment environments/staging.json \
  --bail \
  --timeout-request 15000 \
  --reporters cli,junit \
  --reporter-junit-export smoke-test-results.xml
```

#### Advanced Execution Options
```bash
# Parallel execution for speed
newman run collections/nofx-smoke-tests.json \
  --environment environments/local.json \
  --bail \
  --timeout-request 10000 \
  --iteration-count 1 \
  --delay-request 100

# With detailed reporting
newman run collections/nofx-smoke-tests.json \
  --environment environments/local.json \
  --reporters cli,json,html \
  --reporter-json-export smoke-results.json \
  --reporter-html-export smoke-report.html
```

### NPM Script Integration

Add to `package.json`:
```json
{
  "scripts": {
    "test:smoke": "newman run collections/nofx-smoke-tests.json --environment environments/local.json --bail",
    "test:smoke:staging": "newman run collections/nofx-smoke-tests.json --environment environments/staging.json --bail",
    "test:smoke:prod": "newman run collections/nofx-smoke-tests.json --environment environments/production.json --bail --timeout-request 5000",
    "smoke:quick": "newman run collections/nofx-smoke-tests.json --environment environments/local.json --bail --timeout-request 5000 --reporters cli",
    "smoke:verbose": "newman run collections/nofx-smoke-tests.json --environment environments/local.json --reporters cli,json --reporter-json-export smoke-results.json"
  }
}
```

## CI/CD Pipeline Integration

### GitHub Actions
```yaml
# .github/workflows/smoke-tests.yml
name: Smoke Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  deployment_status:

jobs:
  smoke-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'

    - name: Install Newman
      run: npm install -g newman

    - name: Run Local Smoke Tests
      run: |
        npm run dev &
        sleep 10
        npm run test:smoke

    - name: Run Production Health Check
      if: github.event_name == 'deployment_status' && github.event.deployment_status.state == 'success'
      run: npm run test:smoke:prod
      env:
        ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
```

### Vercel Integration
```bash
# vercel.json
{
  "builds": [
    {
      "src": "src/api/main.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/src/api/main.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

## Best Practices

### Test Design Principles

#### 1. Independent Tests
```javascript
// Each test should be self-contained
pm.test('API responds correctly', () => {
    // Don't depend on previous test results
    pm.response.to.have.status(200);
});
```

#### 2. Clear Failure Messages
```javascript
pm.test('Database connectivity', () => {
    const health = pm.response.json();
    pm.expect(health.database, 'Database should be connected').to.eql('connected');
});
```

#### 3. Reasonable Timeouts
```javascript
// Set appropriate timeouts for critical operations
pm.test('Response time acceptable for smoke test', () => {
    pm.expect(pm.response.responseTime).to.be.below(10000); // 10 seconds max
});
```

#### 4. Environment-Specific Expectations
```javascript
// Adjust expectations based on environment
const maxResponseTime = pm.environment.get('environment') === 'production' ? 5000 : 10000;
pm.test('Response time meets environment SLA', () => {
    pm.expect(pm.response.responseTime).to.be.below(maxResponseTime);
});
```

### Data Management

#### 1. Minimal Test Data
```json
// Use minimal data for smoke tests
{
  "plan": {
    "goal": "Smoke test",
    "steps": [{
      "name": "minimal-test",
      "tool": "codegen",
      "inputs": {
        "prompt": "Hello"
      }
    }]
  }
}
```

#### 2. Cleanup After Tests
```javascript
pm.test('Cleanup smoke test data', () => {
    // Delete test run if needed
    if (pm.globals.get('smokeRunId')) {
        // Cleanup logic here
    }
});
```

#### 3. Dynamic Data Generation
```javascript
// Generate unique test data
pm.globals.set('testRunName', `smoke-test-${Date.now()}`);
```

## Troubleshooting

### Common Issues

#### 1. Timeout Errors
```bash
# Increase timeout for slow environments
newman run collections/nofx-smoke-tests.json \
  --timeout-request 30000 \
  --timeout-script 10000
```

#### 2. Authentication Failures
```javascript
// Debug authentication issues
pm.test('Debug auth cookies', () => {
    console.log('Available cookies:', pm.cookies.toObject());
    console.log('Admin cookie value:', pm.cookies.get('admin'));
});
```

#### 3. Environment Variables
```bash
# Check environment variable loading
newman run collections/nofx-smoke-tests.json \
  --environment environments/local.json \
  --env-var "baseUrl=http://localhost:3001"
```

### Debugging Techniques

#### 1. Verbose Output
```bash
# Enable verbose logging
newman run collections/nofx-smoke-tests.json \
  --verbose \
  --reporters cli
```

#### 2. Request/Response Logging
```javascript
// Log request details for debugging
pm.test('Log request details', () => {
    console.log('Request URL:', pm.request.url.toString());
    console.log('Response status:', pm.response.status);
    console.log('Response body:', pm.response.text());
});
```

#### 3. Step-by-Step Execution
```bash
# Run tests one at a time for debugging
newman run collections/nofx-smoke-tests.json \
  --folder "Health Check" \
  --environment environments/local.json
```

## Performance Optimization

### Speed Optimization
1. **Parallel Execution** - Run independent tests concurrently
2. **Minimal Assertions** - Only test critical functionality
3. **Fast Timeouts** - Set aggressive timeouts for smoke tests
4. **Connection Reuse** - Leverage HTTP keep-alive

### Resource Optimization
1. **Lightweight Payloads** - Use minimal request/response data
2. **Essential Endpoints Only** - Focus on critical path validation
3. **Efficient Test Logic** - Optimize test script performance

## Monitoring and Alerting

### Success Metrics
- **Execution Time** - Target: < 30 seconds
- **Success Rate** - Target: 99.9%
- **Mean Time to Detect** - Target: < 2 minutes

### Alert Conditions
1. **Any smoke test failure** - Immediate alert
2. **Response time degradation** - Alert if > 2x baseline
3. **Consecutive failures** - Alert after 2 failed runs

### Dashboard Integration
```bash
# Export results for monitoring
newman run collections/nofx-smoke-tests.json \
  --reporters json \
  --reporter-json-export /monitoring/smoke-results.json
```

## Success Criteria

### Pre-Deployment Gates
- ✅ All Tier 1 tests pass (100%)
- ✅ All Tier 2 tests pass (90%+)
- ✅ Total execution time < 30 seconds
- ✅ No authentication failures
- ✅ All critical endpoints respond

### Post-Deployment Validation
- ✅ Production smoke tests pass
- ✅ Response times within SLA
- ✅ No degradation from baseline
- ✅ All environments consistent

---

**Note**: This smoke testing strategy provides fast feedback while maintaining comprehensive coverage of critical functionality. Regular review and updates ensure smoke tests remain effective as the system evolves.