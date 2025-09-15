---
name: debug
description: Advanced debugging and root cause analysis with systematic troubleshooting
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: COMPREHENSIVE SYSTEM DEBUGGING**
Analyzing entire system for issues, examining all logs, traces, and potential problem areas...
{{else}}
**Mode: FOCUSED DEBUGGING**
Focusing on recent issues and current context. I will:
1. Debug errors in recently modified code
2. Analyze issues in the current execution context
3. Focus on problems you've mentioned or shown me

To debug across the entire system, use: `/debug --all`
{{/if}}

Perform systematic debugging and root cause analysis to identify and fix complex issues:

## Debugging Strategy

### 1. Problem Identification
**Gather Information:**
- Exact error messages and stack traces
- Steps to reproduce the issue
- Environment where issue occurs (dev/staging/prod)
- Recent changes that might have triggered it
- Frequency and patterns of occurrence
- User impact and severity assessment
- Related logs and monitoring data

### 2. Hypothesis Formation
**Systematic Approach:**
1. **Reproduce the issue** consistently in controlled environment
2. **Isolate the problem** to smallest possible code section
3. **Form hypotheses** about potential causes
4. **Test each hypothesis** methodically
5. **Verify the fix** doesn't introduce regressions
6. **Document findings** for future reference

## Debugging Techniques

### Interactive Debugging
**Breakpoint Strategy:**
```javascript
// Strategic breakpoint placement
function complexOperation(data) {
  debugger; // Initial entry point
  
  const validated = validateInput(data);
  console.assert(validated !== null, 'Validation failed', data);
  
  const transformed = transformData(validated);
  console.log('Transformation result:', transformed);
  
  if (process.env.DEBUG) {
    console.trace('Call stack at transformation');
  }
  
  const result = processData(transformed);
  console.table(result); // Visualize structured data
  
  return result;
}
```

**Advanced Breakpoints:**
- Conditional breakpoints for specific scenarios
- Logpoints for non-intrusive debugging
- Exception breakpoints for error catching
- DOM breakpoints for UI debugging
- XHR/Fetch breakpoints for network issues
- Event listener breakpoints

### Logging and Tracing

**Structured Logging:**
```javascript
class DebugLogger {
  constructor(module) {
    this.module = module;
    this.enabled = process.env.DEBUG?.includes(module);
  }
  
  log(level, message, context = {}) {
    if (!this.enabled) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      context,
      stack: new Error().stack,
      memory: process.memoryUsage(),
      pid: process.pid
    };
    
    console.log(JSON.stringify(entry));
  }
  
  trace(operation, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    this.log('trace', `${operation} completed`, {
      duration,
      result: typeof result === 'object' ? JSON.stringify(result) : result
    });
    
    return result;
  }
}
```

**Distributed Tracing:**
- Add correlation IDs to track requests across services
- Implement OpenTelemetry for comprehensive tracing
- Use Jaeger or Zipkin for visualization
- Track request flow through microservices
- Identify bottlenecks and failures

### Memory Debugging

**Memory Leak Detection:**
```javascript
// Memory profiling utilities
class MemoryDebugger {
  constructor() {
    this.baseline = null;
    this.snapshots = [];
  }
  
  captureBaseline() {
    if (global.gc) global.gc(); // Force GC if exposed
    this.baseline = process.memoryUsage();
    console.log('Baseline memory:', this.baseline);
  }
  
  captureSnapshot(label) {
    if (global.gc) global.gc();
    const current = process.memoryUsage();
    const diff = this.baseline ? {
      heapUsed: current.heapUsed - this.baseline.heapUsed,
      external: current.external - this.baseline.external,
      arrayBuffers: current.arrayBuffers - this.baseline.arrayBuffers
    } : null;
    
    this.snapshots.push({ label, current, diff });
    console.log(`Memory at ${label}:`, { current, diff });
  }
  
  detectLeaks() {
    const growing = this.snapshots.filter((s, i) => 
      i > 0 && s.diff?.heapUsed > this.snapshots[i-1].diff?.heapUsed
    );
    
    if (growing.length > 3) {
      console.warn('Potential memory leak detected:', growing);
    }
  }
}
```

**Heap Analysis:**
- Take heap snapshots at different points
- Compare snapshots to find growing objects
- Identify retainers preventing GC
- Check for circular references
- Monitor WeakMap/WeakSet usage
- Verify event listener cleanup

### Performance Debugging

**Performance Profiling:**
```javascript
class PerformanceDebugger {
  constructor() {
    this.marks = new Map();
    this.measures = [];
  }
  
  mark(name) {
    performance.mark(name);
    this.marks.set(name, performance.now());
  }
  
  measure(name, startMark, endMark) {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name, 'measure')[0];
    this.measures.push({
      name,
      duration: measure.duration,
      timestamp: new Date().toISOString()
    });
    
    if (measure.duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${measure.duration}ms`);
    }
  }
  
  profile(name, fn) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    this.mark(startMark);
    const result = fn();
    this.mark(endMark);
    this.measure(name, startMark, endMark);
    
    return result;
  }
  
  report() {
    console.table(this.measures);
    const slowest = this.measures.sort((a, b) => b.duration - a.duration).slice(0, 5);
    console.log('Slowest operations:', slowest);
  }
}
```

### Network Debugging

**Request Inspection:**
```javascript
// Network request interceptor
class NetworkDebugger {
  constructor() {
    this.requests = [];
    this.failures = [];
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Axios interceptor example
    axios.interceptors.request.use(
      config => {
        config.metadata = { startTime: Date.now() };
        this.logRequest(config);
        return config;
      },
      error => {
        this.logError(error);
        return Promise.reject(error);
      }
    );
    
    axios.interceptors.response.use(
      response => {
        const duration = Date.now() - response.config.metadata.startTime;
        this.logResponse(response, duration);
        return response;
      },
      error => {
        const duration = Date.now() - error.config.metadata.startTime;
        this.logError(error, duration);
        return Promise.reject(error);
      }
    );
  }
  
  logRequest(config) {
    const entry = {
      method: config.method,
      url: config.url,
      headers: config.headers,
      data: config.data,
      timestamp: new Date().toISOString()
    };
    this.requests.push(entry);
    console.log('→ Request:', entry);
  }
  
  logResponse(response, duration) {
    console.log('← Response:', {
      status: response.status,
      duration: `${duration}ms`,
      data: response.data
    });
  }
  
  logError(error, duration) {
    const entry = {
      message: error.message,
      code: error.code,
      duration: duration ? `${duration}ms` : 'N/A',
      stack: error.stack
    };
    this.failures.push(entry);
    console.error('✗ Network Error:', entry);
  }
}
```

### Async Debugging

**Promise Debugging:**
```javascript
// Promise rejection tracking
class PromiseDebugger {
  constructor() {
    this.pendingPromises = new Set();
    this.rejections = [];
    this.setupHandlers();
  }
  
  setupHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection:', reason);
      this.rejections.push({
        reason,
        promise,
        stack: new Error().stack,
        timestamp: new Date().toISOString()
      });
    });
    
    process.on('rejectionHandled', (promise) => {
      console.log('Rejection Handled:', promise);
    });
  }
  
  trackPromise(promise, label) {
    this.pendingPromises.add({ promise, label, start: Date.now() });
    
    promise.finally(() => {
      const entry = Array.from(this.pendingPromises)
        .find(p => p.promise === promise);
      if (entry) {
        const duration = Date.now() - entry.start;
        console.log(`Promise "${entry.label}" completed in ${duration}ms`);
        this.pendingPromises.delete(entry);
      }
    });
    
    return promise;
  }
  
  detectHangingPromises() {
    const now = Date.now();
    const hanging = Array.from(this.pendingPromises)
      .filter(p => now - p.start > 5000);
    
    if (hanging.length > 0) {
      console.warn('Hanging promises detected:', hanging.map(h => h.label));
    }
  }
}
```

### State Debugging

**State Inspection:**
```javascript
// Redux/State debugging
class StateDebugger {
  constructor(store) {
    this.store = store;
    this.history = [];
    this.setupMiddleware();
  }
  
  setupMiddleware() {
    return store => next => action => {
      const prevState = store.getState();
      const result = next(action);
      const nextState = store.getState();
      
      const diff = this.computeDiff(prevState, nextState);
      
      this.history.push({
        action,
        prevState,
        nextState,
        diff,
        timestamp: Date.now()
      });
      
      console.log('Action:', action.type);
      console.log('State Diff:', diff);
      
      return result;
    };
  }
  
  computeDiff(prev, next) {
    // Implement deep diff logic
    const diff = {};
    for (const key in next) {
      if (prev[key] !== next[key]) {
        diff[key] = {
          prev: prev[key],
          next: next[key]
        };
      }
    }
    return diff;
  }
  
  timeTravel(steps) {
    const target = this.history[this.history.length - steps];
    if (target) {
      console.log('Time traveling to:', target);
      // Restore state
    }
  }
}
```

## Root Cause Analysis

### Five Whys Technique
1. **Why did the error occur?** → Database connection timeout
2. **Why did connection timeout?** → Connection pool exhausted
3. **Why was pool exhausted?** → Connections not being released
4. **Why weren't connections released?** → Missing finally block
5. **Why was finally block missing?** → Code review didn't catch it

### Debugging Checklist
- [ ] Error reproduced consistently
- [ ] Root cause identified
- [ ] Fix implemented and tested
- [ ] Edge cases considered
- [ ] Unit tests added for the bug
- [ ] Integration tests verify fix
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] Monitoring added for detection
- [ ] Post-mortem written if critical

## Production Debugging

### Safe Production Debugging
**Feature Flags for Debug Mode:**
```javascript
if (featureFlags.debugMode && userRole === 'admin') {
  // Enable verbose logging
  // Add debug endpoints
  // Show diagnostic UI
}
```

**Canary Debugging:**
- Enable debug mode for small user percentage
- Gradual rollout with monitoring
- Quick rollback capability
- A/B test debug fixes

### Remote Debugging
- Use source maps for production debugging
- Implement remote logging endpoints
- Use APM tools for production insights
- Set up SSH tunnels for secure access
- Use Chrome DevTools Protocol for remote inspection

## Debug Tooling

### Essential Tools
1. **Browser DevTools**: Elements, Console, Network, Performance, Memory
2. **Node.js**: --inspect, node-inspector, ndb
3. **VS Code**: Debugger, Logpoints, Data breakpoints
4. **Chrome**: Lighthouse, React DevTools, Redux DevTools
5. **Network**: Wireshark, Charles Proxy, Postman
6. **Performance**: perf, flamegraphs, clinic.js
7. **Memory**: heapdump, memwatch-next, leakage

## Fix Verification

### Validation Steps
1. **Fix Application**: Apply the minimal change needed
2. **Test Locally**: Verify fix in development
3. **Write Tests**: Add regression tests
4. **Test Edge Cases**: Consider related scenarios
5. **Performance Check**: Ensure no degradation
6. **Security Review**: Verify no vulnerabilities introduced
7. **Deploy to Staging**: Test in production-like environment
8. **Monitor Production**: Watch for issue recurrence

Begin systematic debugging now, identify root cause, implement fix, and verify resolution.

## Command Completion

✅ `/debug $ARGUMENTS` command complete.

Summary: Completed systematic debugging with root cause analysis, issue resolution, and verification testing.