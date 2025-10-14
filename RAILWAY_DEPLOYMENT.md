# Railway Worker Deployment Guide

## Quick Start (Recommended: GitHub Integration)

### Step 1: Connect Repository to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository: `volacci/nofx-local-starter`
5. Railway will detect the project automatically

### Step 2: Configure the Service

1. In the Railway dashboard, click on your project
2. Click "New" → "Service" (or it may auto-create one)
3. Configure the service:
   - **Name**: `nofx-worker`
   - **Root Directory**: `/` (leave as root)
   - **Start Command**: `npm run dev:worker`

### Step 3: Set Environment Variables

Click on your service, then go to the "Variables" tab and add:

```bash
# Required
DATABASE_URL=<your-supabase-postgresql-url>
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Queue Configuration
QUEUE_DRIVER=postgres

# Worker Configuration  
NODE_ENV=production
LOG_LEVEL=info
STEP_TIMEOUT_MS=30000
WORKER_BATCH_SIZE=10

# AI API Keys (if needed for handlers)
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>

# Optional: For health checks
HEALTH_CHECK_ENABLED=true
```

### Step 4: Deploy

1. Railway will automatically deploy when you push to `main`
2. Or click "Deploy" in the Railway dashboard
3. Watch the build logs to ensure it succeeds

### Step 5: Verify Deployment

Check the logs in Railway dashboard:
- Look for: `Worker up` message
- Check for any error messages
- Verify database connection

## Alternative: Manual CLI Deployment

If you want to use the CLI (requires installation):

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project (or create new)
railway link

# Set environment variables
railway variables set DATABASE_URL="your-database-url"
railway variables set QUEUE_DRIVER="postgres"
# ... (add all other variables)

# Deploy
railway up

# View logs
railway logs
```

## Alternative: Docker Deployment

Railway also supports Docker. A `Dockerfile.worker` has been created for you.

To use Docker deployment:
1. In Railway dashboard, go to Settings
2. Set "Builder" to "Dockerfile"
3. Set "Dockerfile Path" to `Dockerfile.worker`
4. Redeploy

## Environment Variables from Vercel

You already have these set in Vercel. Copy the same values to Railway:

```bash
# Get them from Vercel
vercel env pull .env.vercel

# Then manually copy to Railway dashboard
# Or use Railway CLI:
railway variables set $(cat .env.vercel)
```

## Monitoring

### Health Checks
The worker includes a health check server on port 3001 (if enabled):
- Endpoint: `http://localhost:3001/health`
- Returns: Worker status, jobs processed, errors

### Logs
View logs in Railway dashboard or via CLI:
```bash
railway logs --follow
```

### Metrics
Check the Railway dashboard for:
- CPU usage
- Memory usage  
- Restart count
- Network activity

## Troubleshooting

### Worker not processing jobs
1. Check DATABASE_URL is correct
2. Verify QUEUE_DRIVER=postgres
3. Check logs for connection errors
4. Ensure Supabase allows Railway's IP ranges

### Build failures
1. Check Node.js version (should be 20.x)
2. Verify package.json dependencies
3. Check build logs for specific errors

### High memory usage
1. Reduce WORKER_BATCH_SIZE
2. Adjust STEP_TIMEOUT_MS
3. Monitor for memory leaks in handlers

## Cost Estimation

Railway free tier includes:
- $5 credit per month
- Suitable for development/low-traffic
- Worker typically uses ~$3-10/month

For production, consider:
- Pro plan: $20/month
- Or optimize worker to run on-demand

## Next Steps

After deployment:
1. Test by creating a run in your Vercel frontend
2. Watch Railway logs to see worker pick it up
3. Verify run completes successfully
4. Set up alerts for failures (Railway supports webhooks)

## Disable Vercel Cron

Since Railway is now handling worker execution, you should disable the Vercel cron:

1. Edit `vercel.json`
2. Comment out or remove the crons section:
```json
// "crons": [
//   {
//     "path": "/api/worker",
//     "schedule": "* * * * *"
//   }
// ]
```
3. Commit and push

This prevents duplicate processing and saves Vercel function invocations.
