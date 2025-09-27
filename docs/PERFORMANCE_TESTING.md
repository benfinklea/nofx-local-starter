# NOFX Performance Testing & Benchmarking

## Overview

This document describes the comprehensive performance testing and benchmarking system implemented for the NOFX Control Plane. The system provides real-time monitoring, automated benchmarks, and performance regression detection.

## 🚀 Quick Start

### Running Performance Tests

```bash
# Run all performance benchmarks
npm run test:benchmarks

# Run load testing with Artillery
npm run test:performance

# Run comprehensive performance suite
npm run test:performance-full

# Start performance monitoring dashboard
npm run perf:monitor
```

### Viewing Results

1. **Real-time Dashboard**: Open `benchmarks/dashboard.html` in your browser
2. **API Endpoints**: Access `/api/performance/*` endpoints
3. **Test Reports**: Check `benchmarks/results/` directory

## 📊 System Components

### 1. Performance Monitor (`src/lib/performance-monitor.ts`)

Real-time performance monitoring with configurable thresholds:

- **Response Time Tracking**: Automatic HTTP request monitoring
- **Memory Usage**: Heap and RSS memory tracking
- **Error Rate**: Request success/failure rates
- **Alert System**: Configurable thresholds with warnings/critical alerts

```typescript
import { performanceMonitor } from '../lib/performance-monitor';

// Start monitoring
performanceMonitor.start();

// Get current status
const isHealthy = performanceMonitor.isHealthy();
const summary = performanceMonitor.getSummary();
```

### 2. Benchmark Runner (`src/lib/benchmarks.ts`)

Comprehensive benchmarking with suite management:

- **Benchmark Suites**: Organized test collections
- **Threshold Validation**: Performance regression detection
- **Memory & CPU Tracking**: Resource usage analysis
- **Report Generation**: Detailed performance reports

```typescript
import {
  createBenchmarkSuite,
  benchmark,
  completeBenchmarkSuite
} from '../lib/benchmarks';

// Create a benchmark suite
createBenchmarkSuite('api-tests', 'API performance tests', {
  maxDuration: 100,
  maxMemoryMB: 10
});

// Run a benchmark
const { result, benchmark: benchmarkResult } = await benchmark(
  'test-name',
  async () => {
    // Your test code here
    return someResult;
  }
);

// Complete suite and generate report
const suite = completeBenchmarkSuite();
```

### 3. Performance API Routes (`src/api/routes/performance.ts`)

RESTful API for accessing performance data:

```bash
# Current performance snapshot
GET /api/performance/current

# Performance summary with time ranges
GET /api/performance/summary?timeRange=3600000

# Recent snapshots
GET /api/performance/snapshots?count=100

# Benchmark suite statistics
GET /api/benchmarks/stats/:suiteName

# Health check with performance status
GET /api/performance/health
```

## 🎯 Performance Thresholds

### Default Thresholds

```typescript
const thresholds = {
  responseTime: { warning: 100, critical: 500 }, // milliseconds
  memoryUsage: { warning: 512, critical: 1024 }, // MB
  cpuUsage: { warning: 70, critical: 90 },       // percentage
  errorRate: { warning: 5, critical: 10 },       // percentage
  queueDepth: { warning: 100, critical: 500 }    // items
};
```

### Benchmark Thresholds

- **API Endpoints**: < 100ms response time
- **Database Queries**: < 50ms execution time
- **Memory Allocation**: < 10MB per operation
- **CPU Usage**: < 50% per benchmark

## 📈 Benchmark Test Suites

### API Endpoint Benchmarks

Located in `tests/performance/benchmarks.test.ts`:

- Health check performance
- Run creation endpoints
- Metrics endpoint performance
- Concurrent request handling

### Database Benchmarks

- Connection establishment
- Simple queries
- Complex queries with joins
- Transaction performance

### Resource Usage Benchmarks

- Memory allocation patterns
- CPU-intensive operations
- JSON parsing performance
- Concurrent promise handling

### Regression Tests

- Baseline comparison
- Memory leak detection
- Performance degradation alerts

## 🔧 Configuration

### Environment Variables

```bash
# Enable stress testing
ENABLE_STRESS_TESTS=1

# Disable Redis stress tests
DISABLE_REDIS_STRESS=1

# API URL for testing
API_URL=http://localhost:3000

# Database connection
DATABASE_URL=postgresql://user:pass@localhost/db
```

### Custom Thresholds

Update thresholds via API:

```bash
curl -X POST http://localhost:3000/api/performance/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "responseTime": { "warning": 150, "critical": 600 },
    "memoryUsage": { "warning": 256, "critical": 512 }
  }'
```

## 📊 Performance Dashboard

The interactive dashboard (`benchmarks/dashboard.html`) provides:

- **Real-time Metrics**: Live performance data
- **Historical Charts**: Response time, memory, error rate trends
- **System Health**: Overall health status with indicators
- **Benchmark Results**: Recent benchmark statistics
- **Alert Notifications**: Performance threshold violations

### Dashboard Features

- **Auto-refresh**: Updates every 5 seconds
- **Responsive Design**: Works on desktop and mobile
- **Interactive Charts**: Hover for detailed metrics
- **Status Indicators**: Color-coded health status

## 🚨 Alerting & Monitoring

### Alert Levels

1. **Warning**: Performance approaching thresholds
2. **Critical**: Performance exceeding safe limits

### Alert Channels

- Console logging with emoji indicators
- Event emission for custom integrations
- Dashboard notifications

### Example Alert Integration

```typescript
import { performanceMonitor } from '../lib/performance-monitor';

performanceMonitor.on('alert', (alert) => {
  console.log(`${alert.level}: ${alert.message}`);

  // Send to external monitoring service
  if (alert.level === 'critical') {
    notifyPagerDuty(alert);
  }
});
```

## 🔄 Continuous Integration

### GitHub Actions Integration

Add to your CI pipeline:

```yaml
- name: Run Performance Tests
  run: |
    npm run test:benchmarks
    npm run test:performance

- name: Check Performance Thresholds
  run: |
    # Performance tests will fail if thresholds are exceeded
    echo "Performance tests completed successfully"
```

### Performance Regression Detection

The system automatically compares results against baselines:

```typescript
// Automatic regression detection
const stats = getBenchmarkStats('api-endpoints');
if (stats.avgDuration > baseline.avgDuration * 1.2) {
  throw new Error('Performance regression detected!');
}
```

## 📝 Best Practices

### Writing Performance Tests

1. **Isolate Tests**: Each benchmark should test one specific operation
2. **Use Realistic Data**: Test with production-like data sizes
3. **Set Appropriate Thresholds**: Based on your performance requirements
4. **Clean Up Resources**: Ensure tests don't leak memory or connections

### Monitoring in Production

1. **Start Monitoring Early**: Enable monitoring during application startup
2. **Set Conservative Thresholds**: Allow for traffic spikes
3. **Monitor Trends**: Look for gradual performance degradation
4. **Correlate with Business Metrics**: Performance should align with user experience

### Performance Optimization Workflow

1. **Establish Baseline**: Run benchmarks on current code
2. **Make Changes**: Implement optimizations
3. **Re-run Benchmarks**: Compare against baseline
4. **Validate in Production**: Monitor real-world performance

## 🛠️ Troubleshooting

### Common Issues

**High Memory Usage**
```bash
# Check for memory leaks
npm run test:benchmarks -- --testNamePattern="memory leak"
```

**Slow Response Times**
```bash
# Run specific API benchmarks
npm run test:benchmarks -- --testNamePattern="API"
```

**Database Performance**
```bash
# Test database operations
npm run test:benchmarks -- --testNamePattern="Database"
```

### Debug Mode

Enable detailed logging:

```typescript
// Enable debug output
process.env.DEBUG = 'performance:*';
```

## 📚 API Reference

### Performance Monitor API

- `performanceMonitor.start()` - Start monitoring
- `performanceMonitor.stop()` - Stop monitoring
- `performanceMonitor.getCurrentSnapshot()` - Get current metrics
- `performanceMonitor.getSummary(timeRange?)` - Get performance summary
- `performanceMonitor.isHealthy()` - Check system health
- `performanceMonitor.reset()` - Reset all metrics

### Benchmark Runner API

- `createBenchmarkSuite(name, description?, thresholds?)` - Create suite
- `benchmark(name, fn, metadata?)` - Run benchmark
- `completeBenchmarkSuite()` - Complete current suite
- `getBenchmarkStats(suiteName)` - Get suite statistics
- `generateBenchmarkReport(suiteName)` - Generate report
- `exportBenchmarkResults(suiteName?)` - Export to JSON

## 🔮 Future Enhancements

- [ ] Performance trend analysis
- [ ] Automated performance optimization suggestions
- [ ] Integration with APM tools (New Relic, DataDog)
- [ ] Custom performance budgets
- [ ] Performance test scheduling
- [ ] Advanced regression analysis

## 📞 Support

For questions or issues with the performance testing system:

1. Check the troubleshooting section above
2. Review the test output and logs
3. Open an issue with performance data and reproduction steps
4. Tag performance-related issues with `performance` label

---

*This performance testing system is designed to help maintain optimal performance and catch regressions early in the development cycle.*