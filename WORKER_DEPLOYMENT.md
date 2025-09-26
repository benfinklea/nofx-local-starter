# Redis Worker Deployment Guide

## Overview
The NOFX worker processes background jobs from a Redis queue. Since Vercel Functions are serverless and can't run long-running processes, the worker must be deployed separately.

## Architecture
```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Vercel API     │──────▶  │  Redis Queue │  ◀──────│  Worker Process │
│  (Serverless)   │         │  (Upstash)   │         │  (Railway/Fly)  │
└─────────────────┘         └──────────────┘         └─────────────────┘
        │                                                      │
        ▼                                                      ▼
┌─────────────────┐                                 ┌─────────────────┐
│   Supabase DB   │ ◀───────────────────────────────│   Supabase DB   │
└─────────────────┘                                 └─────────────────┘
```

## Quick Start

### 1. Set up Redis (Upstash Recommended)
1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the Redis URL (looks like: `redis://default:xxxxx@xxxxx.upstash.io:6379`)

### 2. Local Testing with Docker
```bash
# Start Redis and worker locally
docker-compose -f docker-compose.worker.yml up

# Or run worker directly
npm run dev:worker
```

### 3. Deploy to Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Link to your project
railway link

# Set environment variables
railway variables set QUEUE_DRIVER=redis
railway variables set REDIS_URL=<your-upstash-redis-url>
railway variables set DATABASE_URL=<your-supabase-postgres-url>
railway variables set SUPABASE_URL=<your-supabase-url>
railway variables set SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

# Deploy
railway up
```

### 4. Deploy to Fly.io (Alternative)
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Create fly.toml
cat > fly.toml << EOF
app = "nofx-worker"
primary_region = "lax"

[build]
  dockerfile = "Dockerfile.worker"

[env]
  NODE_ENV = "production"
  QUEUE_DRIVER = "redis"
  WORKER_CONCURRENCY = "2"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.health_checks]]
    grace_period = "5s"
    interval = "15s"
    method = "get"
    path = "/health"
    protocol = "http"
    restart_limit = 3
    timeout = "2s"
EOF

# Deploy
fly deploy
```

## Environment Variables

### Required for Worker
```env
# Queue Configuration
QUEUE_DRIVER=redis                    # Use 'redis' for production, 'memory' for local
REDIS_URL=redis://...                 # Your Redis connection URL

# Database
DATABASE_URL=postgresql://...         # Supabase PostgreSQL URL
SUPABASE_URL=https://...              # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...        # Service role key (not anon key!)

# AI Providers (if using AI handlers)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional Configuration
```env
WORKER_CONCURRENCY=2                  # Number of concurrent jobs (default: 1)
STEP_TIMEOUT_MS=30000                 # Step timeout in milliseconds (default: 30000)
LOG_LEVEL=info                        # Logging level (debug|info|warn|error)
HEARTBEAT_INTERVAL_MS=5000           # Worker heartbeat interval
MAX_RETRY_ATTEMPTS=3                  # Maximum retry attempts for failed jobs
RETRY_BACKOFF_MS=5000                # Initial retry backoff time
```

### Update Vercel Environment
In your Vercel dashboard, add:
```env
QUEUE_DRIVER=redis
REDIS_URL=<same-redis-url-as-worker>
```

## Testing the Setup

### 1. Check Worker Health
```bash
# Check Railway logs
railway logs

# Or Fly.io logs
fly logs
```

### 2. Test Queue Connection
```bash
# Create a test run via API
curl -X POST https://your-app.vercel.app/api/runs \
  -H "Content-Type: application/json" \
  -d '{"plan": {"goal": "test", "steps": []}}'

# Check worker logs for processing
railway logs --tail
```

### 3. Monitor Queue
Use Upstash console or Redis CLI:
```bash
redis-cli -u $REDIS_URL
> KEYS step.*
> LLEN step.ready
```

## Troubleshooting

### Worker Not Processing Jobs
1. Check `QUEUE_DRIVER=redis` in both Vercel and worker
2. Verify Redis URL is identical in both deployments
3. Check worker logs for connection errors

### Authentication Errors
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is used (not anon key)
2. Verify DATABASE_URL includes proper credentials

### Memory Issues
1. Reduce `WORKER_CONCURRENCY` to 1
2. Increase container memory limits
3. Check for memory leaks in handlers

### Connection Timeouts
1. Verify Redis allows connections from deployment region
2. Check network policies in Railway/Fly
3. Ensure SSL/TLS settings match Redis provider

## Monitoring

### Recommended Tools
- **Upstash Console** - Built-in Redis monitoring
- **Railway Metrics** - CPU, memory, and logs
- **Sentry** - Error tracking (add SENTRY_DSN to env)
- **Datadog** - APM and custom metrics

### Health Check Endpoint
The worker includes a health check that verifies:
- Redis connection
- Database connection
- Queue processing status

## Production Checklist

- [ ] Redis instance provisioned (Upstash/Redis Labs)
- [ ] Environment variables set in worker deployment
- [ ] Environment variables updated in Vercel
- [ ] Worker deployed and running
- [ ] Queue processing verified
- [ ] Error tracking configured
- [ ] Monitoring dashboards set up
- [ ] Backup Redis configured (if critical)
- [ ] Auto-scaling configured (if needed)
- [ ] Alerting configured for failures

## Cost Optimization

### Upstash Redis (Recommended)
- Pay-per-request pricing
- Free tier: 10,000 commands/day
- No idle charges

### Railway
- $5/month per service
- Usage-based pricing for resources
- Free $5 credit monthly

### Fly.io
- Free tier: 3 shared VMs
- Pay for additional resources
- Good for multi-region deployment

## Support & Debugging

### View Worker Logs
```bash
# Railway
railway logs --tail

# Fly.io
fly logs --tail

# Docker (local)
docker-compose -f docker-compose.worker.yml logs -f worker
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Worker not starting | Check Docker build logs, verify Node version |
| Redis connection refused | Verify REDIS_URL, check firewall rules |
| Jobs not processing | Ensure QUEUE_DRIVER=redis in both services |
| Out of memory | Reduce concurrency, increase container limits |
| Slow processing | Check network latency, optimize handlers |

## Advanced Configuration

### Custom Handlers
Add new handlers in `src/worker/handlers/`:
```typescript
// src/worker/handlers/custom.ts
export default async function customHandler(context: StepContext) {
  // Implementation
}
```

### Queue Priorities
Modify `src/lib/queue/RedisAdapter.ts` to add priority queues.

### Distributed Workers
Deploy multiple worker instances with same Redis connection for horizontal scaling.

## Next Steps

1. **Set up Upstash Redis** - Get your Redis URL
2. **Deploy Worker** - Choose Railway or Fly.io
3. **Configure Vercel** - Update environment variables
4. **Test End-to-End** - Create a run and verify processing
5. **Monitor** - Set up logging and alerting