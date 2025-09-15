---
name: optimize
description: Optimize code for maximum performance, efficiency, and resource utilization
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL APPLICATION OPTIMIZATION**
Analyzing entire application for performance bottlenecks and optimization opportunities...
{{else}}
**Mode: RECENT CODE OPTIMIZATION**
Focusing on recently modified code in the current session. I will:
1. Optimize files modified in the last commit or staging area
2. Improve performance of code you've recently shown me or discussed
3. Focus on the current working context and hot paths

To optimize the entire application instead, use: `/optimize --all`
{{/if}}

Analyze and optimize code for maximum performance, efficiency, and minimal resource utilization:

## Performance Analysis

### 1. Profiling and Benchmarking
**Initial Assessment:**
- Profile CPU usage and identify hot paths
- Measure memory allocation and garbage collection
- Analyze database query performance
- Monitor network request latency
- Track rendering/paint performance
- Identify blocking operations
- Measure time complexity of algorithms
- Analyze space complexity and memory leaks

### 2. Bottleneck Identification
**Critical Areas:**
- **CPU Bound**: Expensive calculations, inefficient algorithms
- **Memory Bound**: Large data structures, memory leaks
- **I/O Bound**: Database queries, file operations, network calls
- **Rendering**: DOM manipulation, reflows, repaints
- **Concurrency**: Lock contention, race conditions
- **Cache Misses**: Poor locality, inefficient data access

## Optimization Strategies

### Algorithm Optimization
**Complexity Reduction:**
```javascript
// Before: O(n²) nested loops
function findDuplicates(arr) {
  const duplicates = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}

// After: O(n) with Set
function findDuplicates(arr) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }
  return Array.from(duplicates);
}
```

**Data Structure Selection:**
- Use Map/Set for O(1) lookups instead of Array.includes O(n)
- Implement priority queues with heaps for O(log n) operations
- Use tries for prefix searches
- Apply bloom filters for membership testing
- Implement LRU caches for frequently accessed data

### Memory Optimization

**Memory Management:**
- Pool and reuse objects to reduce GC pressure
- Use WeakMap/WeakSet for metadata storage
- Implement object pooling for frequently created/destroyed objects
- Clear references to enable garbage collection
- Use typed arrays for numeric data
- Implement lazy loading and pagination
- Stream large datasets instead of loading entirely

**Memory Leak Prevention:**
```javascript
// Before: Memory leak with event listeners
class Component {
  constructor() {
    this.handleClick = this.handleClick.bind(this);
    document.addEventListener('click', this.handleClick);
  }
  handleClick() { /* ... */ }
}

// After: Proper cleanup
class Component {
  constructor() {
    this.handleClick = this.handleClick.bind(this);
    this.cleanup = () => {
      document.removeEventListener('click', this.handleClick);
    };
    document.addEventListener('click', this.handleClick);
  }
  destroy() {
    this.cleanup();
  }
  handleClick() { /* ... */ }
}
```

### Database Optimization

**Query Optimization:**
- Add appropriate indexes for WHERE, JOIN, ORDER BY columns
- Use covering indexes to avoid table lookups
- Implement query result caching with TTL
- Batch database operations to reduce round trips
- Use prepared statements and connection pooling
- Optimize N+1 queries with eager loading
- Implement database query pagination
- Use read replicas for read-heavy workloads

**Schema Optimization:**
```sql
-- Before: Inefficient schema
SELECT * FROM orders o
JOIN users u ON o.user_id = u.id
WHERE u.email = 'user@example.com'
AND o.created_at > '2024-01-01';

-- After: Optimized with indexes and denormalization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);

-- Consider denormalizing for read performance
ALTER TABLE orders ADD COLUMN user_email VARCHAR(255);
CREATE INDEX idx_orders_email_created ON orders(user_email, created_at);
```

### Network Optimization

**Request Optimization:**
- Implement request batching and debouncing
- Use HTTP/2 multiplexing
- Enable gzip/brotli compression
- Implement aggressive caching strategies
- Use CDN for static assets
- Minimize payload sizes with field filtering
- Implement GraphQL for precise data fetching
- Use WebSockets for real-time updates

**Asset Optimization:**
- Lazy load images and components
- Implement code splitting and tree shaking
- Minify and compress JavaScript/CSS
- Use WebP/AVIF image formats
- Implement responsive images with srcset
- Inline critical CSS
- Prefetch/preload critical resources
- Use service workers for offline caching

### Frontend Optimization

**Rendering Performance:**
```javascript
// Before: Expensive DOM manipulation
function updateList(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
}

// After: Optimized with DocumentFragment
function updateList(items) {
  const list = document.getElementById('list');
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    fragment.appendChild(li);
  });
  list.innerHTML = '';
  list.appendChild(fragment);
}

// Best: Virtual DOM or efficient diffing
function updateList(items) {
  requestAnimationFrame(() => {
    // Use React, Vue, or virtual-dom library
    virtualRender(items);
  });
}
```

**React/Vue Optimization:**
- Implement React.memo/Vue computed for expensive computations
- Use useMemo/useCallback to prevent unnecessary re-renders
- Implement virtual scrolling for long lists
- Use production builds with optimizations
- Lazy load routes and components
- Optimize re-renders with proper key usage
- Use Suspense for async components

### Concurrency Optimization

**Parallel Processing:**
```javascript
// Before: Sequential processing
async function processItems(items) {
  const results = [];
  for (const item of items) {
    const result = await processItem(item);
    results.push(result);
  }
  return results;
}

// After: Parallel processing with controlled concurrency
async function processItems(items, concurrency = 5) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const promise = processItem(item).then(result => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}
```

**Worker Threads:**
- Offload CPU-intensive tasks to Web Workers
- Use Worker pools for parallel processing
- Implement SharedArrayBuffer for efficient data sharing
- Use Atomics for synchronization
- Distribute work across multiple cores

### Caching Strategies

**Multi-Level Caching:**
1. **Browser Cache**: Cache-Control headers, ETags
2. **CDN Cache**: Edge caching for static assets
3. **Application Cache**: In-memory caching (Redis/Memcached)
4. **Database Cache**: Query result caching
5. **Computation Cache**: Memoization of expensive calculations

**Cache Implementation:**
```javascript
// LRU Cache with TTL
class LRUCache {
  constructor(maxSize = 100, ttl = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }
}
```

## Build-Time Optimization

### Bundle Optimization
- Enable tree shaking to remove dead code
- Implement code splitting by route/feature
- Use dynamic imports for lazy loading
- Optimize webpack/rollup configuration
- Analyze bundle size with tools
- Remove unnecessary dependencies
- Use production mode optimizations

### Compilation Optimization
- Enable compiler optimizations (O2/O3)
- Use PGO (Profile-Guided Optimization)
- Implement link-time optimization
- Use native addons for critical paths
- Compile to WebAssembly for performance

## Monitoring and Metrics

### Performance Metrics
**Track Key Indicators:**
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- API response times (p50, p95, p99)
- Database query times
- Memory usage over time
- CPU utilization
- Error rates

### Continuous Monitoring
- Set up APM (Application Performance Monitoring)
- Implement real user monitoring (RUM)
- Create performance budgets
- Set up alerts for regression
- Track performance trends
- A/B test optimizations

## Optimization Validation

### Before/After Comparison
1. **Baseline Metrics**: Capture current performance
2. **Apply Optimization**: Implement changes incrementally
3. **Measure Impact**: Compare against baseline
4. **Validate Correctness**: Ensure functionality preserved
5. **Monitor Production**: Track real-world impact

### Success Criteria
- 50% reduction in response times
- 30% reduction in memory usage
- 90% cache hit ratio
- < 100ms server response time
- < 3s page load time
- Zero memory leaks
- Linear scalability with load

Begin optimization analysis now, implement improvements, and validate performance gains.

## Command Completion

✅ `/optimize $ARGUMENTS` command complete.

Summary: Optimized code for maximum performance with algorithm improvements, memory optimization, and bottleneck resolution.