# ✅ Database Connection Pool Fixes Implemented

## Summary

Fixed critical Supabase connection pooling issues for Vercel serverless deployment based on production best practices.

## 🔧 Changes Made

### 1. Updated `src/lib/db.ts` - Database Pool Configuration

**Before:**
```typescript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

**After:**
```typescript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Serverless-optimized settings
  max: 1,                      // One connection per function
  allowExitOnIdle: true,       // Prevents connection leaking
  idleTimeoutMillis: 30000,    // Close idle connections
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  query_timeout: 30000,
});
```

**Key improvements:**
- ✅ Prevents connection leaking (the #1 Supabase + Vercel issue)
- ✅ Optimized for serverless (max: 1 connection)
- ✅ Automatic connection cleanup
- ✅ Query timeouts to prevent long-running queries

### 2. Added Connection Monitoring

**Event handlers added:**
```typescript
pool.on('error', (err) => { /* Log unexpected errors */ });
pool.on('connect', (client) => { /* Log connection establishment */ });
pool.on('remove', () => { /* Log connection removal */ });
```

**Benefits:**
- Track connection lifecycle
- Debug connection pool issues
- Monitor pool health (totalCount, idleCount, waitingCount)

### 3. Added DATABASE_URL Validation

**Automatic validation on startup:**
- Checks for `pooler.supabase.com` hostname
- Validates port `6543` (transaction mode, not `5432` session mode)
- Warns if misconfigured

**Prevents this common error:**
```
Error: prepared statement "..." does not exist
```

### 4. Created `src/lib/validateEnv.ts` - Environment Validation Module

**Features:**
- Validates required environment variables
- Checks DATABASE_URL format
- Warns about common misconfigurations
- Provides environment info for debugging

**Usage:**
```typescript
import { validateEnvOrThrow } from './lib/validateEnv';

// At API startup
validateEnvOrThrow();
```

### 5. Created `.env.production.template` - Environment Documentation

**Comprehensive template including:**
- DATABASE_URL format requirements (with examples)
- All Supabase variables
- Worker authentication
- API keys (OpenAI, Anthropic, Google)
- Stripe configuration
- Deployment checklist

**Use this as a guide when configuring Vercel environment variables.**

---

## 🚨 Critical Actions Required

### Before Next Deploy:

1. **Verify DATABASE_URL in Vercel Dashboard**

Go to: Vercel → Project Settings → Environment Variables

**Check that DATABASE_URL:**
- ✅ Contains `pooler.supabase.com`
- ✅ Uses port `:6543`
- ✅ NOT `:5432`

**Example correct format:**
```
postgresql://postgres.xxxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**If your DATABASE_URL uses port 5432 or db.supabase.co:**

Get the correct URL from:
- Supabase Dashboard → Project Settings → Database
- Connection string section → "Transaction" mode
- Copy the "Connection pooling" URL

2. **Set Environment Scope**

Make sure DATABASE_URL is set for:
- [x] Production
- [x] Preview
- [x] Development

3. **Redeploy After Env Var Changes**

Environment variable changes don't trigger automatic redeployment.

After updating DATABASE_URL, manually redeploy:
```bash
git commit --allow-empty -m "chore: trigger redeploy for env vars"
git push
```

Or use Vercel dashboard: Deployments → Redeploy

---

## 📊 How to Monitor

### Check Supabase Connection Pool

Supabase Dashboard → Database → Connection Pooling

**Healthy metrics:**
- Active connections: < 10 (typically 1-3)
- Connection usage: < 50%
- No stuck idle connections

**Warning signs:**
- Active connections steadily increasing
- Connection usage > 80%
- Many idle connections that don't close

### Check Vercel Function Logs

Vercel Dashboard → Functions → Logs

**Look for:**
- ✅ "Database connection established"
- ✅ "Database connection removed"
- ⚠️ "DATABASE_URL may not be using Supabase transaction pooler"
- 🚨 "Unexpected database pool error"

---

## 🧪 Testing

### 1. Local Testing

```bash
# Set DATABASE_URL to use pooler
export DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"

# Start dev server
npm run dev:api

# Should see:
# ✅ Environment variables validated
# ✅ Database connection established
```

### 2. Production Testing

After deploying:

```bash
# Make API requests and watch Supabase connection count
curl https://your-app.vercel.app/api/runs

# Check Supabase Dashboard
# - Connections should briefly spike
# - Then drop back down within 30 seconds
# - Should not stay elevated
```

### 3. Stress Test

```bash
# Make 100 parallel requests
for i in {1..100}; do
  curl https://your-app.vercel.app/api/runs &
done
wait

# Monitor in Supabase Dashboard:
# - Peak connections should be < 50
# - Should return to baseline within 1 minute
# - No connection leaks
```

---

## 🐛 Troubleshooting

### "prepared statement does not exist"

**Cause:** Using session mode (port 5432) instead of transaction mode (port 6543)

**Fix:**
1. Update DATABASE_URL to use `pooler.supabase.com:6543`
2. Redeploy

### "too many connections"

**Cause:** Connection leaking

**Check:**
- Supabase free plan limit: 200 connections
- Look for stuck idle connections
- Check if connections are closing

**Fix:**
1. Verify `allowExitOnIdle: true` in pool config
2. Monitor connection lifecycle in logs
3. Consider upgrading Supabase plan if legitimately need more connections

### "Connection terminated unexpectedly"

**Cause:** Query taking longer than timeout (30 seconds)

**Fix:**
1. Optimize slow queries
2. Add indexes to database
3. Increase timeout if needed (but investigate why query is slow)

---

## 📚 References

- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel Serverless Best Practices](https://vercel.com/docs/functions/serverless-functions)
- [Connection Pooling with Serverless](https://vercel.com/guides/connection-pooling-with-serverless-functions)

---

## ✅ Deployment Checklist

- [x] Updated `src/lib/db.ts` with serverless pool config
- [x] Added connection monitoring
- [x] Created environment validation module
- [x] Created `.env.production.template`
- [ ] **Verify DATABASE_URL in Vercel uses pooler (port 6543)**
- [ ] **Redeploy after env var verification**
- [ ] Monitor Supabase connection count after deploy
- [ ] Check Vercel function logs for warnings
- [ ] Run stress test to verify no connection leaks

---

**Status:** Code changes complete. Configuration verification required before deploy.
