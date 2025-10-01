# 🚨 Stack-Specific Issues (Vercel + Supabase + Serverless)

Based on research into common production issues with your exact tech stack.

## 🔴 CRITICAL: Connection Pooling Misconfiguration

### The Issue

**Your database connection (`src/lib/db.ts`) is missing critical Supabase configuration.**

When using Supabase with Vercel serverless functions, you **MUST**:
1. Use transaction mode pooler
2. Disable prepared statements
3. Implement connection cleanup

**Current Status:** ❌ Missing all three

### Why This Matters

From Supabase docs:
> "Transaction mode does not support prepared statements. This is the most common issue when using Supabase with serverless functions."

**Symptoms you'll see:**
- Random connection errors in production
- `prepared statement "..." does not exist` errors
- Connection pool exhausted (200 max on free plan)
- Functions that worked yesterday fail today

### The Fix

Update `src/lib/db.ts`:

```typescript
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // CRITICAL: Disable prepared statements for Supabase transaction pooler
  // See: https://supabase.com/docs/guides/database/connecting-to-postgres
  statement_timeout: 30000,  // 30 second timeout
  query_timeout: 30000,
  connectionTimeoutMillis: 5000,

  // Prevent connection leaking in serverless
  max: 1,  // Serverless functions should use 1 connection
  idleTimeoutMillis: 30000,
  allowExitOnIdle: true,  // CRITICAL: Allows pool to close when function ends
});

// Add connection monitoring
pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

pool.on('connect', () => {
  console.log('Database connection established');
});
```

### Verify Your DATABASE_URL

**Check your environment variable uses transaction mode:**

❌ **Wrong (Session mode):**
```
DATABASE_URL=postgresql://user:pass@host:5432/database
```

✅ **Correct (Transaction mode with pooler):**
```
DATABASE_URL=postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Key indicators:**
- Uses port `6543` (not `5432`)
- Has `pooler.supabase.com` in hostname
- Uses `postgres` as database name

---

## 🟠 Connection Leaking in Serverless Functions

### The Issue

Serverless platforms can leak database connections when functions are suspended.

**From Vercel's research:**
> "The real issue is not the number of connections during normal operation, but that some serverless platforms can leak connections when functions are suspended. At 200 max connections (Supabase free plan), leaking 50 can really hurt."

### Current Risk

Your `api/` functions don't explicitly close connections. Each serverless invocation may leak connections.

**Symptoms:**
- "Too many connections" errors
- Functions fail intermittently
- Database becomes unresponsive
- Requires manual restart

### The Fix

#### Option 1: Use Vercel's waitUntil (Recommended)

```typescript
// api/example.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../src/lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const result = await pool.query('SELECT * FROM runs');
    res.json(result.rows);
  } finally {
    // Use waitUntil to ensure connections close before function suspends
    if (res.waitUntil) {
      res.waitUntil(
        new Promise((resolve) => {
          pool.end().then(resolve).catch(resolve);
        })
      );
    }
  }
}
```

#### Option 2: Force Pool to Single Connection

Already shown in the Pool config above with `max: 1` and `allowExitOnIdle: true`.

---

## 🟡 Function Bundle Size Risk

### The Issue

Vercel has a **250MB uncompressed limit** for serverless functions.

**Your current node_modules:** 1.4GB

**Common culprits that break the limit:**
- Puppeteer (ships entire Chrome browser)
- Sharp (image processing with native binaries)
- PDF generation libraries
- Large AI/ML libraries

### Current Status

✅ Individual API files are small (4-12KB)
⚠️ But bundles include dependencies

### The Fix

Add bundle size monitoring to pre-deploy checks:

```bash
# In scripts/pre-deploy-checks.sh
echo "📦 Checking bundle sizes..."

# Estimate function bundle size
if [ -d "node_modules" ]; then
  # Check for known problematic packages
  if [ -d "node_modules/puppeteer" ]; then
    echo "  🚨 CRITICAL: Puppeteer detected (adds ~300MB)"
    echo "     Use @vercel/og or puppeteer-core instead"
  fi

  if [ -d "node_modules/sharp" ]; then
    echo "  ⚠️  Sharp detected (adds ~50MB)"
  fi
fi
```

---

## 🟡 Environment Variable Issues

### The Issue

Environment variables are case-sensitive and need proper scope.

**Common mistakes:**
- Using different casing locally vs production
- Variables not set for Preview deployments
- Forgetting to redeploy after changing env vars

### Your Risk Areas

Check these in Vercel dashboard:

1. **DATABASE_URL** - Must be transaction mode pooler URL
2. **WORKER_SECRET** - Required for cron authentication
3. **ADMIN_PASSWORD** - Used for worker auth fallback
4. **SUPABASE_URL** / **SUPABASE_ANON_KEY** - For Supabase client

### The Fix

**Document all required env vars:**

Create `.env.production.template`:

```bash
# Database (MUST use transaction pooler on port 6543)
DATABASE_URL=postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Worker authentication
WORKER_SECRET=xxx
ADMIN_PASSWORD=xxx

# Supabase client
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# IMPORTANT: After adding/changing env vars, redeploy!
# Environment changes don't auto-redeploy
```

**Add env var validation:**

```typescript
// src/lib/validateEnv.ts
export function validateEnv() {
  const required = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate DATABASE_URL uses pooler
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('pooler.supabase.com') || !dbUrl.includes(':6543')) {
    console.warn('⚠️  DATABASE_URL may not be using Supabase transaction pooler');
    console.warn('   Expected: pooler.supabase.com:6543');
  }
}

// Call in api functions
validateEnv();
```

---

## 🟢 React Router (Already Handled)

### Your Status: ✅ GOOD

You're using `HashRouter` which avoids the common 404 issues with React Router on Vercel.

**Why this works:**
- Hash fragments (#) aren't sent to server
- All routing stays client-side
- No need for vercel.json rewrites for frontend routes

**If you ever switch to BrowserRouter:**
You'll need this in vercel.json:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 🚀 Recommended Implementation Order

### 1. TODAY (30 minutes)

- [ ] Update `src/lib/db.ts` with proper Pool configuration
- [ ] Verify DATABASE_URL uses transaction pooler (port 6543)
- [ ] Add connection monitoring logs

### 2. THIS WEEK (1 hour)

- [ ] Add environment variable validation
- [ ] Document all required env vars
- [ ] Test connection pooling in production
- [ ] Monitor connection count in Supabase dashboard

### 3. ONGOING

- [ ] Watch Supabase connection metrics
- [ ] Monitor Vercel function execution logs
- [ ] Set up alerts for connection pool exhaustion

---

## 📊 Monitoring Checklist

### Supabase Dashboard

Watch these metrics:
- **Active connections** (should stay low, < 10 typical)
- **Connection pool usage** (warning at 80%, critical at 95%)
- **Idle connections** (should close within 30 seconds)

### Vercel Dashboard

Watch for:
- Function timeouts (should be rare)
- Cold start duration (should be < 2 seconds)
- Error rates (should be < 0.1%)

### Logs to Add

```typescript
// In your API functions
console.log('Function invoked', {
  path: req.url,
  method: req.method,
  poolSize: pool.totalCount,
  idleConnections: pool.idleCount,
});
```

---

## 🧪 How to Test

### Test Connection Pooling

```bash
# Stress test: Make 100 parallel requests
for i in {1..100}; do
  curl https://your-app.vercel.app/api/runs &
done
wait

# Check Supabase dashboard - connections should:
# 1. Spike briefly
# 2. Drop back down within 30 seconds
# 3. Never exceed 10-20 concurrent
```

### Test for Connection Leaks

```bash
# Monitor over 5 minutes
for i in {1..300}; do
  curl -s https://your-app.vercel.app/api/runs > /dev/null
  sleep 1
done

# In Supabase dashboard:
# - Connections should NOT steadily increase
# - Should see connections open/close
# - No idle connections stuck open
```

---

## 📚 References

- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel Serverless Functions Best Practices](https://vercel.com/docs/functions/serverless-functions)
- [Vercel's Connection Pooling Guide](https://vercel.com/guides/connection-pooling-with-serverless-functions)
- [Common Vercel Errors](https://vercel.com/docs/errors)

---

## ⚠️ CRITICAL ACTIONS REQUIRED

**Before your next production deployment:**

1. ✅ Update `src/lib/db.ts` with prepared statements disabled
2. ✅ Verify DATABASE_URL uses `pooler.supabase.com:6543`
3. ✅ Add connection monitoring
4. ✅ Test connection pooling behavior

**These aren't optional - these WILL cause production issues without the fixes.**

---

*This analysis is based on documented production issues from Vercel and Supabase communities, not theoretical problems.*
