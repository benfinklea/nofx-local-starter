# NOFX Control Plane Troubleshooting Guide

**Updated:** September 29, 2025 (Post-cloud migration & Agent SDK integration)

## System Overview

NOFX Control Plane runs on:
- **Production:** Vercel (https://nofx-control-plane.vercel.app) + Supabase
- **Local Development:** Node.js with Supabase connection

## Quick Diagnostics

### Production Issues

#### API Not Responding
```bash
# Check API health
curl https://nofx-control-plane.vercel.app/api/health

# Check Vercel status
vercel whoami
vercel ls

# View deployment logs
vercel logs
```

**Common causes:**
- Vercel function timeout (max 60s for Hobby, 300s for Pro)
- Environment variables not set in Vercel dashboard
- Supabase connection issues

#### Database Connection Issues
```bash
# Test Supabase connection
curl https://YOUR-PROJECT.supabase.co/rest/v1/?apikey=YOUR-ANON-KEY

# Check Supabase project status (dashboard)
open https://supabase.com/dashboard/project/YOUR-PROJECT-ID
```

**Solutions:**
- Verify `DATABASE_URL` in Vercel environment variables
- Check Supabase project is not paused
- Verify connection pooling settings (6543 for pooler, 5432 for direct)

#### Jobs Not Processing
```bash
# Check queue status via API
curl https://nofx-control-plane.vercel.app/api/queue/status

# Check for stuck jobs in database
# (Use Supabase SQL Editor)
SELECT * FROM nofx.queue_jobs WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;
```

**Common causes:**
- PostgreSQL queue not properly migrated
- Worker function not deployed
- Idempotency key conflicts

### Local Development Issues

#### "Cannot connect to Supabase"
```bash
# Check environment variables
grep -E "SUPABASE_URL|DATABASE_URL" .env

# Test connection
npm run dev:api
# Should see "✅ Database connected" in logs
```

**Solutions:**
- Copy `.env.example` to `.env`
- Get Supabase credentials from project dashboard
- Use pooler URL (port 6543) not direct connection (port 5432)

#### TypeScript Errors
```bash
# Run typecheck
npm run typecheck

# Common fixes
npm install  # Ensure dependencies are installed
rm -rf node_modules package-lock.json && npm install  # Clean install
```

#### Test Failures
```bash
# Run specific test suites
npm run test:unit
npm run test:integration

# Check for environment issues
RESPONSES_RUNTIME_MODE=stub npm test
```

## Common Error Messages

### "ECONNREFUSED" or Connection Errors

**Production:**
- Check Supabase project is active (not paused)
- Verify `DATABASE_URL` in Vercel dashboard
- Ensure connection string uses pooler (port 6543)

**Local:**
- Verify `.env` has correct `SUPABASE_URL` and `DATABASE_URL`
- Check internet connection (local connects to cloud Supabase)

### "Worker timeout after 30000ms"

**Production:**
- Vercel function timeout limits:
  - Hobby plan: 10s (API), 60s (background)
  - Pro plan: 300s maximum
- Consider breaking long-running jobs into smaller steps
- Use status polling instead of long-running connections

**Local:**
- Adjust timeout in code if needed for development
- Check for infinite loops or hanging operations

### "Idempotency key conflict"

```sql
-- Find duplicate idempotency keys
SELECT idempotency_key, COUNT(*)
FROM nofx.step
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

**Solution:**
- This is usually correct behavior (prevents duplicate execution)
- If stuck, check step status and manually update if needed
- Ensure proper cleanup of completed steps

### "Agent SDK initialization failed"

```bash
# Check Agent SDK is installed
npm list @anthropic-ai/claude-agent-sdk

# Verify API key
grep ANTHROPIC_API_KEY .env

# Check logs for detailed error
npm run dev:api 2>&1 | grep -A 5 "Agent SDK"
```

**Solutions:**
- Ensure `@anthropic-ai/claude-agent-sdk@^0.1.0` is in dependencies
- Set `ANTHROPIC_API_KEY` in environment variables
- Review Agent SDK migration docs: `Docs/AGENT_SDK_PHASE1_COMPLETE.md`

## Performance Issues

### Slow Response Times

**Check Performance Monitoring:**
```bash
# Access super admin dashboard (local dev)
npm run admin:super
# Or production: https://your-app.vercel.app/admin/super-admin/dashboard

# Check specific metrics
curl https://nofx-control-plane.vercel.app/api/public/performance/current
```

**Common Solutions:**
- Review database queries (use Supabase dashboard to analyze slow queries)
- Check for N+1 query problems
- Ensure proper indexes on frequently queried columns
- Consider caching for repeated requests

### High Memory Usage (Local)

```bash
# Monitor Node.js memory
node --max-old-space-size=4096 src/api/main.ts

# Profile memory usage
npm run profile
npm run profile:analyze
```

## Debugging Workflow

### 1. Check System Health
```bash
# Production
curl https://nofx-control-plane.vercel.app/api/health

# Local
curl http://localhost:3000/health
```

### 2. Review Logs

**Production (Vercel):**
```bash
vercel logs --follow
# Or use Vercel dashboard: https://vercel.com/dashboard
```

**Local:**
```bash
# API logs
npm run dev:api

# Worker logs
npm run dev:worker

# With debug mode
DEBUG=nofx:* npm run dev:api
```

### 3. Check Database State

**Use Supabase SQL Editor:**
```sql
-- Check recent runs
SELECT id, status, created_at FROM nofx.run ORDER BY created_at DESC LIMIT 10;

-- Check pending steps
SELECT r.id as run_id, s.name, s.status, s.started_at
FROM nofx.step s
JOIN nofx.run r ON s.run_id = r.id
WHERE s.status IN ('pending', 'running')
ORDER BY s.created_at DESC;

-- Check queue depth
SELECT status, COUNT(*) FROM nofx.queue_jobs GROUP BY status;
```

### 4. Test Specific Components

```bash
# Test API endpoints
npm run ai-test:auth  # Authentication
npm run ai-test:run   # Run creation
npm run ai-test:status  # Status checking

# Run specific test suites
npm run test:unit -- --testPathPattern=orchestration
npm run test:integration -- --testPathPattern=agent-sdk
```

## Environment-Specific Issues

### Production Only

**Issue:** Works locally but fails in production

**Checklist:**
- [ ] All environment variables set in Vercel dashboard
- [ ] Same Node.js version (check `package.json` engines field)
- [ ] Dependencies properly installed (check Vercel build logs)
- [ ] No reliance on local file system (use Supabase Storage)
- [ ] Timeout limits respected (Vercel has strict limits)

### Local Only

**Issue:** Works in production but fails locally

**Checklist:**
- [ ] `.env` file exists and has all required variables
- [ ] Node.js version matches production (use nvm)
- [ ] Database migrations applied to Supabase
- [ ] No CORS issues with localhost

## Emergency Procedures

### Production Incident Response

1. **Check status dashboard:**
   ```bash
   curl https://nofx-control-plane.vercel.app/api/health
   ```

2. **Review recent deployments:**
   ```bash
   vercel ls
   vercel inspect [deployment-url]
   ```

3. **Rollback if needed:**
   ```bash
   # Revert to previous deployment
   vercel rollback [previous-deployment-url]
   ```

4. **Check Supabase:**
   - Dashboard: https://supabase.com/dashboard
   - Verify no service disruptions
   - Check connection pooler status

### Data Recovery

**PostgreSQL Queue:**
```sql
-- Reset stuck jobs (use carefully!)
UPDATE nofx.queue_jobs
SET status = 'pending', processing_started_at = NULL
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '10 minutes';
```

**Run Recovery:**
```sql
-- Find failed runs
SELECT * FROM nofx.run WHERE status = 'failed' ORDER BY created_at DESC;

-- Check associated errors
SELECT * FROM nofx.event WHERE run_id = 'YOUR-RUN-ID' AND event_type LIKE '%.failed';
```

## Useful Commands Reference

```bash
# Development
npm run dev                 # Start API + Worker
npm run dev:api             # API only
npm run dev:worker          # Worker only
npm run fe:dev              # Frontend dev server

# Testing
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:bulletproof    # Full test suite

# Deployment
vercel                      # Deploy to preview
vercel --prod               # Deploy to production
vercel logs                 # View production logs

# Database
npm run create:bucket       # Create Supabase storage bucket
npm run seed:dbwrite        # Seed db_write rules

# Validation
npm run typecheck           # TypeScript check
npm run lint                # Lint code
npm run gates               # Run all quality gates

# Registry
npm run registry:agents:validate     # Validate agent definitions
npm run registry:templates:validate  # Validate templates

# Navigation
npm run nav:validate        # Validate navigation structure
```

## Getting More Help

1. **Check Documentation:**
   - Main guide: `/AI_CODER_GUIDE.md`
   - API reference: `/Docs/control-plane/API_REFERENCE.md`
   - Setup guides: `/Docs/setup/`

2. **Review Recent Changes:**
   ```bash
   git log --oneline --since="1 week ago"
   ```

3. **Check for Known Issues:**
   - GitHub issues (if public repo)
   - Recent commits for bug fixes

4. **Debug Mode:**
   ```bash
   DEBUG=nofx:* npm run dev:api
   ```

## Architecture Reference

### Production Stack
```
┌──────────────────────────────────┐
│      Vercel Edge Network         │
│  ┌──────────┐   ┌──────────┐   │
│  │ API      │   │ Worker   │   │
│  │ Functions│   │ Functions│   │
│  └────┬─────┘   └────┬─────┘   │
└───────┼──────────────┼──────────┘
        │              │
        └──────┬───────┘
               │
        ┌──────▼────────┐
        │   Supabase    │
        ├───────────────┤
        │ • PostgreSQL  │
        │ • Queue       │
        │ • Storage     │
        │ • Auth        │
        └───────────────┘
```

### Key Principles
- **No Redis in production** - Uses PostgreSQL queue
- **No Docker in production** - Serverless functions
- **All data in Supabase** - Single source of truth
- **Agent SDK for AI** - @anthropic-ai/claude-agent-sdk

---

*For historical reference (pre-migration troubleshooting), see `archive/TROUBLESHOOTING_OLD.md`*