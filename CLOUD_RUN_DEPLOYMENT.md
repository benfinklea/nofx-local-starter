# Google Cloud Run Worker Deployment Guide

## Overview

The NOFX system uses a **hybrid architecture** to handle different types of work:

- **Vercel (Serverless)**: Frontend, API endpoints, simple handlers (codegen, bash, etc.)
- **Google Cloud Run (Container)**: Gate execution (typecheck, lint, sast, tests)

This separation is necessary because gates require:
- Full Node.js environment with CLI tools (tsc, eslint, jest)
- Write access to file system
- Long execution times (30-120 seconds)

All of which are unavailable in Vercel's serverless environment.

## Prerequisites

1. **Google Cloud Account**: You already have one ✅
2. **gcloud CLI**: Install from https://cloud.google.com/sdk/docs/install
3. **DATABASE_URL**: Your Supabase connection string (same one used in Vercel)

## Step 1: Install gcloud CLI (if needed)

```bash
# macOS
brew install google-cloud-sdk

# Or download installer:
# https://cloud.google.com/sdk/docs/install
```

## Step 2: Authenticate with Google Cloud

```bash
# Login to your Google account
gcloud auth login

# Set your project (or create a new one)
gcloud projects list
gcloud config set project YOUR_PROJECT_ID

# Example:
# gcloud config set project nofx-production
```

## Step 3: Get your DATABASE_URL

From your Supabase project:
1. Go to Project Settings → Database
2. Copy the **Connection String** (Transaction mode)
3. Make sure it uses port **6543** (transaction pooler)

Should look like:
```
postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].pooler.supabase.com:6543/postgres
```

## Step 4: Deploy to Cloud Run

```bash
# Set your DATABASE_URL (replace with your actual connection string)
export DATABASE_URL='postgresql://postgres:yourpass@xyz.pooler.supabase.com:6543/postgres'

# Optional: Set your project ID if different from default
export GCP_PROJECT_ID='your-project-id'

# Run the deployment script
./deploy-cloud-run.sh
```

The script will:
1. ✅ Enable required Google Cloud APIs
2. 🏗️ Build a Docker container from your code
3. 🚀 Deploy to Cloud Run with proper configuration
4. 📊 Output the service URL and logs command

**Expected time**: 3-5 minutes for first deployment

## Step 5: Verify Deployment

After deployment completes, you'll see:
```
Service URL: https://nofx-gate-worker-xyz-uc.a.run.app
Health check: https://nofx-gate-worker-xyz-uc.a.run.app/health
```

Test the health endpoint:
```bash
curl https://nofx-gate-worker-xyz-uc.a.run.app/health
```

Should return:
```json
{
  "status": "healthy",
  "worker": "nofx-cloud-gate-worker",
  "uptime": 123.45,
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

## Step 6: View Logs

```bash
# Tail logs in real-time
gcloud run logs tail nofx-gate-worker --region us-central1

# Or view in Google Cloud Console:
# https://console.cloud.google.com/run
```

## Step 7: Test with a Real Run

1. Go to your NOFX frontend
2. Create a new run that includes gates (typecheck, lint, etc.)
3. Watch the logs to see the worker pick up and process the gate steps

```bash
gcloud run logs tail nofx-gate-worker --region us-central1
```

You should see:
```
Found 2 gate steps to process
Processing gate step: gate:typecheck
Gate step succeeded: gate:typecheck
Processing gate step: gate:lint
Gate step succeeded: gate:lint
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
│                         ↓                               │
│               NOFX Frontend (Vercel)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              API Endpoints (Vercel)                     │
│  • POST /runs - Create new runs                         │
│  • GET /runs/:id - Get run status                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            Supabase PostgreSQL Database                 │
│  • Stores runs, steps, events                           │
│  • Shared by both workers                               │
└─────────────────────────────────────────────────────────┘
                ↓                           ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│   Vercel Cron Worker     │    │  Cloud Run Worker        │
│   (Every minute)         │    │  (Continuous polling)    │
│                          │    │                          │
│   Handles:               │    │   Handles:               │
│   • codegen              │    │   • gate:typecheck       │
│   • codegen_v2           │    │   • gate:lint            │
│   • bash                 │    │   • gate:sast            │
│   • db_write             │    │   • gate:tests           │
│   • git_ops              │    │                          │
│   • project_init         │    │   Full Node.js env       │
│                          │    │   Write access           │
│   60s timeout            │    │   15min timeout          │
│   Read-only FS           │    │   Read-write FS          │
└──────────────────────────┘    └──────────────────────────┘
```

## Configuration

### Worker Polling Interval
Default: 30 seconds

To change, set environment variable:
```bash
gcloud run services update nofx-gate-worker \
  --region us-central1 \
  --set-env-vars "POLL_INTERVAL_MS=60000"  # 60 seconds
```

### Scaling Configuration
Current settings:
- **Min Instances**: 1 (always running, no cold starts)
- **Max Instances**: 3 (handle burst loads)
- **Memory**: 2GB (enough for test execution)
- **CPU**: 1 vCPU
- **Timeout**: 15 minutes (gates can take a while)

### Cost Estimate
With min-instances=1 (always running):
- **CPU**: 1 vCPU × 730 hours/month = ~$50/month
- **Memory**: 2GB × 730 hours = ~$5/month
- **Requests**: Minimal cost (internal polling)

**Total**: ~$2-5/month (with free tier credits applied)

For lower cost with slower response:
```bash
# Set min-instances to 0 (but adds 1-2 second cold start)
gcloud run services update nofx-gate-worker \
  --region us-central1 \
  --min-instances 0
```

## Troubleshooting

### Worker not processing steps

1. **Check worker is running**:
```bash
gcloud run services describe nofx-gate-worker --region us-central1
```

2. **Check logs for errors**:
```bash
gcloud run logs tail nofx-gate-worker --region us-central1
```

3. **Verify DATABASE_URL is set**:
```bash
gcloud run services describe nofx-gate-worker --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

4. **Check database for pending gate steps**:
```sql
SELECT s.id, s.tool, s.status, s.created_at
FROM nofx.step s
WHERE s.tool LIKE 'gate:%'
AND s.status IN ('pending', 'queued')
ORDER BY s.created_at DESC;
```

### Database connection errors

Make sure DATABASE_URL uses the **transaction pooler** (port 6543), not direct connection (port 5432):
```
✅ CORRECT: pooler.supabase.com:6543
❌ WRONG: db.xyz.supabase.co:5432
```

### Deployment fails

1. **Check gcloud authentication**:
```bash
gcloud auth list
```

2. **Ensure required APIs are enabled**:
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

3. **Check project billing is enabled**:
https://console.cloud.google.com/billing

## Updating the Worker

To deploy code changes:

```bash
# Just run the deployment script again
./deploy-cloud-run.sh
```

Cloud Run will:
1. Build a new container with your changes
2. Deploy it with zero downtime
3. Automatically switch traffic to the new version

## Monitoring

### View metrics in Google Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/nofx-gate-worker/metrics

Metrics include:
- Request count
- Request latency
- Container CPU usage
- Container memory usage
- Active instances

### Set up alerts:
1. Go to Monitoring → Alerting
2. Create alert for:
   - High error rate
   - High CPU usage
   - No requests (worker stopped)

## Philosophy Alignment

This architecture protects non-technical entrepreneurs from broken AI-generated code by:

1. **Quality Gates Always Run**: With min-instances=1, gates execute within 30 seconds of code generation
2. **No Manual Intervention**: Fully automated - entrepreneur doesn't need to think about it
3. **Fail Fast**: Catches TypeScript errors, linting issues, and test failures before they reach production
4. **Observable**: Clear logs and metrics show what's being checked
5. **Reliable**: Cloud Run auto-restarts on failures, ensuring gates always run

Remember: "Make iteration so cheap and fast that imperfect communication doesn't matter" - but not at the cost of deploying broken code. Gates are the safety net.
