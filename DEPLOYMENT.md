# Cloud Deployment Guide - Vercel + Supabase

This guide explains how to deploy the NOFX Control Plane to the cloud so runs execute without your laptop running.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Cloud)                        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │  API Routes  │  │Worker (Cron) │  │
│  │    (SPA)     │  │(Serverless)  │  │Every 1 min   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │          │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │                  └──────────┬───────┘
          │                             │
          └─────────────────────────────┼────────────────┐
                                        │                │
                                        ▼                │
                              ┌─────────────────┐        │
                              │   Supabase      │        │
                              │   PostgreSQL    │        │
                              │   (Database +   │        │
                              │    Storage)     │        │
                              └─────────────────┘        │
```

## Key Components

1. **Frontend (Static SPA)**: Served from Vercel CDN
2. **API Routes**: Vercel serverless functions (auto-scales)
3. **Worker**: Vercel Cron job runs every minute to process pending steps
4. **Database**: Supabase PostgreSQL (manages runs, steps, events)
5. **Storage**: Supabase Storage (artifacts, files)

## Prerequisites

1. **Vercel Account**: [Sign up at vercel.com](https://vercel.com)
2. **Supabase Account**: [Sign up at supabase.com](https://supabase.com)
3. **GitHub Repository**: Your code should be in a GitHub repo
4. **API Keys**: Anthropic, OpenAI, or other AI provider keys

## Deployment Steps

### 1. Set Up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to SQL Editor and run the migration:
   ```sql
   -- Copy contents from: run-supabase-migrations.sql
   -- Or use the Supabase CLI: npx supabase db push
   ```
3. Note your connection details:
   - Project URL: `https://xxx.supabase.co`
   - Anon Key: Found in Settings → API
   - Service Role Key: Found in Settings → API
   - Database URL: Found in Settings → Database

### 2. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Other
   - **Build Command**: Leave default (uses vercel.json)
   - **Output Directory**: Leave default (uses vercel.json)
5. Click "Deploy"

#### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### 3. Configure Environment Variables in Vercel

Go to your project → Settings → Environment Variables and add:

#### Required Variables

```bash
# Environment
NODE_ENV=production

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# Queue Configuration
QUEUE_DRIVER=postgres  # Uses Supabase database - no Redis needed!

# Worker Settings
WORKER_BATCH_SIZE=10
WORKER_SECRET=[GENERATE-STRONG-SECRET]  # Used to manually trigger worker
STEP_TIMEOUT_MS=30000

# AI Provider Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Security
ADMIN_PASSWORD=[STRONG-PASSWORD]
```

#### Optional Variables

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Storage
SUPABASE_BUCKET=nofx-artifacts

# Monitoring (optional)
SENTRY_DSN=[YOUR-SENTRY-DSN]
```

**Important**: After adding environment variables, redeploy your project for them to take effect.

### 4. Verify Deployment

#### Check API Health

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-09-30T...",
  "queue": { "status": "active" },
  "store": { "status": "healthy" }
}
```

#### Check Worker Cron Job

1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. You should see: `/api/worker` running every minute (`* * * * *`)
3. Check the logs to see worker executions

#### Manually Trigger Worker (for testing)

```bash
# Using your WORKER_SECRET
curl -X POST https://your-app.vercel.app/api/worker?secret=YOUR_WORKER_SECRET
```

### 5. Create Your First Cloud Run

```bash
# Login to get a token
curl -X POST https://your-app.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}'

# Create a run
curl -X POST https://your-app.vercel.app/api/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plan": {
      "goal": "Test cloud execution",
      "steps": [{
        "name": "test",
        "tool": "codegen",
        "inputs": {"prompt": "Write hello world"}
      }]
    }
  }'

# Check run status
curl https://your-app.vercel.app/api/runs/RUN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The worker cron job will pick up the pending step within 1 minute and execute it!

## How the Worker Works

1. **Vercel Cron** triggers `/api/worker` every minute
2. **Worker function** queries database for pending steps
3. **Executes steps** using the same `runStep()` logic as local worker
4. **Auto-scales** - Vercel handles the infrastructure
5. **No server management** - completely serverless!

## Cron Schedule Options

The default is every minute (`* * * * *`), but you can adjust in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/worker",
      "schedule": "* * * * *"  // Every minute (fast)
      // "schedule": "*/5 * * * *"  // Every 5 minutes (balanced)
      // "schedule": "*/15 * * * *"  // Every 15 minutes (slow)
    }
  ]
}
```

**Note**: Faster schedules = more responsive but higher Vercel function invocations.

## Monitoring & Logs

### View Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by:
   - Function: `api/worker.ts` (worker logs)
   - Function: `api/runs/index.ts` (API logs)

### Monitor Worker

Check worker status:
```bash
curl https://your-app.vercel.app/api/worker?secret=YOUR_WORKER_SECRET
```

Response shows:
- How many steps were processed
- Success/failure counts
- Processing duration
- Whether there are more pending steps

### Database Monitoring

Use Supabase Dashboard:
1. Go to Database → Tables
2. View `nofx.run` and `nofx.step` tables
3. Check `nofx.event` for audit trail

## Troubleshooting

### Issue: Runs not executing

**Check:**
1. Verify worker cron is enabled in Vercel Dashboard
2. Check worker logs for errors
3. Manually trigger worker to test: `/api/worker?secret=...`
4. Verify `DATABASE_URL` is set correctly
5. Check Supabase database is accessible

### Issue: Worker timing out

**Solution:**
- Reduce `WORKER_BATCH_SIZE` (default: 10)
- Steps taking >30s will timeout (increase `STEP_TIMEOUT_MS`)
- Increase cron frequency to process smaller batches

### Issue: High Vercel costs

**Solutions:**
1. Reduce cron frequency (every 5 or 15 minutes)
2. Reduce `WORKER_BATCH_SIZE`
3. Use Vercel Pro plan for better rates
4. Consider dedicated worker service (Railway, Render) for high volume

## Alternative: Dedicated Worker Service

For **very high volume** workloads (>1000 steps/day), consider a dedicated worker:

### Deploy Worker to Railway/Render

1. Create a `Procfile`:
   ```
   worker: npm run dev:worker
   ```

2. Deploy to [Railway.app](https://railway.app) or [Render.com](https://render.com)

3. Set same environment variables as Vercel

4. Remove cron job from `vercel.json`

**Trade-offs:**
- ✅ Always running (no 1-minute delay)
- ✅ Better for high-volume workloads
- ❌ Costs more ($5-10/month minimum)
- ❌ Requires server management

## Cost Estimates

### Vercel (Hobby Plan - Free)
- 100 GB-hours/month serverless execution
- 100k invocations/month
- **Should handle ~50-100 runs/day easily**

### Vercel Pro ($20/month)
- Unlimited serverless execution
- Better performance
- **Can handle 1000+ runs/day**

### Supabase (Free Tier)
- 500 MB database
- 1 GB storage
- **Should handle most dev/small production workloads**

### Supabase Pro ($25/month)
- 8 GB database
- 100 GB storage
- Better performance

## Security Best Practices

1. **Never commit secrets** to git
2. **Use strong WORKER_SECRET** (prevents unauthorized worker triggers)
3. **Rotate API keys** regularly
4. **Enable Vercel firewall** (Pro plan)
5. **Use Supabase RLS** (Row Level Security) for multi-tenancy
6. **Monitor logs** for suspicious activity

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure environment variables
3. ✅ Verify worker is running
4. Set up monitoring (Sentry, Datadog)
5. Configure custom domain
6. Set up CI/CD for automatic deployments
7. Enable Vercel Web Analytics

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **NOFX Docs**: See `docs/control-plane/`
- **Issues**: GitHub Issues

---

**That's it!** Your NOFX Control Plane is now running in the cloud 24/7 without your laptop. 🚀
