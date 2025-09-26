# NOFX Worker Troubleshooting Guide

## Quick Diagnostics

### 1. Worker Not Processing Jobs

**Symptoms:**
- Jobs stuck in "pending" state
- Queue depth increasing
- No activity in worker logs

**Check:**
```bash
# Check worker health
curl http://localhost:3001/health

# Check Redis connection
docker exec nofx-redis redis-cli ping

# Check queue depth
docker exec nofx-redis redis-cli LLEN step.ready

# View worker logs
docker logs -f nofx-worker --tail 100
```

**Common Causes & Solutions:**

#### Redis Connection Issues
```bash
# Test Redis connection
npm run test:redis

# Check Redis URL in .env
grep REDIS_URL .env

# Verify Redis is running
docker ps | grep redis
```

#### Worker Crashed
```bash
# Check worker status
docker ps -a | grep worker

# Restart worker
docker restart nofx-worker

# Check for OOM kills
dmesg | grep -i "killed process"
```

#### Configuration Issues
```bash
# Verify environment variables
docker exec nofx-worker env | grep -E "QUEUE|REDIS|WORKER"

# Check queue driver setting
grep QUEUE_DRIVER .env
```

### 2. Jobs Failing Repeatedly

**Symptoms:**
- High error rate in metrics
- Jobs moving to DLQ
- Error logs showing consistent failures

**Debug Steps:**
```bash
# Check error logs
docker logs nofx-worker 2>&1 | grep -i error | tail -20

# Inspect DLQ
docker exec nofx-redis redis-cli LRANGE step.dlq 0 10

# Check specific job
curl http://localhost:3001/health/job/:jobId
```

**Common Issues:**

#### Timeout Errors
```bash
# Check timeout setting
grep STEP_TIMEOUT_MS .env

# Monitor long-running jobs
docker logs nofx-worker | grep "step timeout"

# Increase timeout if needed
export STEP_TIMEOUT_MS=60000
```

#### Memory Issues
```bash
# Check memory usage
docker stats nofx-worker

# Check Node heap
docker exec nofx-worker node -e "console.log(process.memoryUsage())"

# Increase memory limit
docker update --memory="2g" nofx-worker
```

#### Database Connection Pool Exhaustion
```bash
# Check active connections
docker exec nofx-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker exec nofx-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';"
```

### 3. Performance Degradation

**Symptoms:**
- Slow job processing
- Increasing queue latency
- High CPU usage

**Performance Analysis:**
```bash
# Profile CPU usage
docker exec nofx-worker node --prof worker.js
# After 1 minute, stop and analyze
docker exec nofx-worker node --prof-process isolate-*.log > profile.txt

# Check event loop lag
curl http://localhost:3001/metrics | grep event_loop_lag

# Monitor Redis operations
docker exec nofx-redis redis-cli --stat
```

**Optimization Steps:**

#### Increase Concurrency
```bash
# Check current concurrency
grep WORKER_CONCURRENCY .env

# Update for more parallel processing
export WORKER_CONCURRENCY=8
docker restart nofx-worker
```

#### Redis Optimization
```bash
# Check Redis memory
docker exec nofx-redis redis-cli INFO memory

# Clear old data
docker exec nofx-redis redis-cli --scan --pattern "inbox:*" | xargs docker exec nofx-redis redis-cli DEL

# Optimize Redis config
docker exec nofx-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 4. Memory Leaks

**Symptoms:**
- Steadily increasing memory usage
- Worker crashes with OOM
- Performance degradation over time

**Detection:**
```bash
# Monitor memory over time
while true; do
  docker stats nofx-worker --no-stream | tee -a memory.log
  sleep 60
done

# Analyze heap dumps
docker exec nofx-worker node --expose-gc --inspect=0.0.0.0:9229 worker.js
# Connect Chrome DevTools to localhost:9229
```

**Fixes:**
```bash
# Force garbage collection (temporary)
docker exec nofx-worker node -e "global.gc()"

# Restart worker periodically (workaround)
echo "0 */6 * * * docker restart nofx-worker" | crontab -

# Update Node.js memory limits
docker run -e NODE_OPTIONS="--max-old-space-size=2048" nofx-worker
```

### 5. Queue Stuck/Corrupted

**Symptoms:**
- Jobs not moving between states
- Inconsistent queue counts
- Redis errors in logs

**Recovery Steps:**
```bash
# Backup current state
docker exec nofx-redis redis-cli BGSAVE

# Check queue integrity
npm run queue:check

# Move stuck jobs back to ready
docker exec nofx-redis redis-cli LRANGE step.processing 0 -1 | \
  xargs -I {} docker exec nofx-redis redis-cli LPUSH step.ready {}

# Clear processing list
docker exec nofx-redis redis-cli DEL step.processing

# Restart worker
docker restart nofx-worker
```

### 6. Health Check Failures

**Symptoms:**
- Deployment rollbacks
- Load balancer removing instances
- Alerts firing

**Debug:**
```bash
# Test all health endpoints
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready

# Check dependencies
curl http://localhost:3001/health/dependencies

# View detailed metrics
curl http://localhost:3001/metrics
```

**Common Fixes:**
```bash
# Increase health check timeout
export HEALTH_CHECK_TIMEOUT=10000

# Disable strict readiness
export HEALTH_CHECK_STRICT=false

# Check port availability
lsof -i :3001
```

## Emergency Procedures

### Complete System Reset
```bash
#!/bin/bash
# Emergency reset script

echo "⚠️  Emergency Reset - This will clear all queue data!"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Stop services
  docker-compose down

  # Clear Redis data
  docker volume rm nofx_redis_data

  # Clear logs
  rm -rf logs/*.log

  # Restart clean
  docker-compose up -d

  echo "✅ System reset complete"
fi
```

### Production Rollback
```bash
# Quick rollback procedure
kubectl rollout undo deployment/worker
# or
railway rollback --service worker
# or
flyctl releases rollback
```

### Data Recovery
```bash
# Restore from Redis backup
docker exec nofx-redis redis-cli --rdb /data/dump.rdb

# Replay from event log
npm run queue:replay --from="2024-01-01" --to="2024-01-02"

# Restore from DLQ
npm run queue:restore-dlq --limit=100
```

## Monitoring Commands

### Real-time Monitoring
```bash
# Watch queue depth
watch -n 1 'docker exec nofx-redis redis-cli LLEN step.ready'

# Monitor worker logs
docker logs -f nofx-worker

# Track error rate
while true; do
  curl -s http://localhost:3001/metrics | grep error_rate
  sleep 5
done
```

### Performance Profiling
```bash
# CPU profiling
docker exec nofx-worker node --cpu-prof worker.js

# Memory profiling
docker exec nofx-worker node --heap-prof worker.js

# Trace events
docker exec nofx-worker node --trace-events-enabled worker.js
```

## Common Error Messages

### "ECONNREFUSED" Redis Connection
```
Error: Redis connection to localhost:6379 failed - connect ECONNREFUSED
```
**Solution:** Start Redis container or check REDIS_URL

### "Step timeout after 30000ms"
```
Error: step timeout
```
**Solution:** Increase STEP_TIMEOUT_MS or optimize step processing

### "Cannot allocate memory"
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```
**Solution:** Increase Node memory limit or fix memory leak

### "Queue depth exceeds threshold"
```
Warning: Queue depth 1000 exceeds threshold
```
**Solution:** Scale workers or investigate processing bottleneck

## Prevention Best Practices

1. **Regular Monitoring**
   - Set up alerts for queue depth > 1000
   - Monitor error rate > 5%
   - Track memory usage trends
   - Watch response time percentiles

2. **Capacity Planning**
   - Load test before major releases
   - Plan for 2x peak traffic
   - Have auto-scaling configured
   - Keep 30% headroom on resources

3. **Operational Hygiene**
   - Regular backup testing
   - Quarterly disaster recovery drills
   - Keep dependencies updated
   - Document all custom configurations

4. **Debugging Tools**
   - Keep profiling tools ready
   - Have heap dump analysis setup
   - Maintain query debugging access
   - Use distributed tracing

## Support Escalation

### Level 1: Self-Service
- Check this troubleshooting guide
- Review logs and metrics
- Try standard recovery procedures

### Level 2: Team Support
- Post in #nofx-support Slack channel
- Include error logs and metrics
- Describe attempted solutions

### Level 3: On-Call
- Page via PagerDuty for production issues
- Include severity and business impact
- Provide access credentials if needed

## Useful Resources

- [Redis Commands Reference](https://redis.io/commands)
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [Docker Troubleshooting](https://docs.docker.com/config/containers/logging/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Production Readiness Checklist](./PRODUCTION_CHECKLIST.md)