# Fix: Runs Disappearing Immediately

## 🔴 Problem Identified

Runs disappear because Vercel is using **filesystem storage** (ephemeral) instead of **database storage** (persistent).

### Root Cause:
The `DATA_DRIVER` environment variable wasn't set, causing the system to use temporary file storage that gets wiped between serverless function invocations.

## ✅ Solution Applied

I've added `DATA_DRIVER=postgres` to your Vercel environment variables and triggered a redeploy.

## 🚀 What's Happening Now

1. **Vercel is redeploying** with the new environment variable
2. **Railway needs the same variable** added

## Next Steps for You:

### Step 1: Add DATA_DRIVER to Railway

Go to your Railway dashboard and add this environment variable:

**Railway Dashboard:** https://railway.app/project/nofx

1. Click on your worker service
2. Go to **"Variables"** tab
3. Add new variable:
   ```
   DATA_DRIVER=postgres
   ```
4. Railway will auto-redeploy

### Step 2: Verify Vercel Deployment

Check that Vercel finished deploying:

```bash
# Check latest deployment status
vercel ls | head -5
```

Or visit: https://vercel.com/volacci/nofx-local-starter/deployments

### Step 3: Test It!

Once both are redeployed:

1. Go to: https://nofx-local-starter-volacci.vercel.app
2. Create a new run
3. **This time it should persist!** ✅
4. Refresh the page - the run should still be there
5. Watch it process in Railway logs

## 🔍 How to Verify It's Fixed

### Test 1: Create a Run
```bash
curl -X POST https://nofx-local-starter-volacci.vercel.app/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "test persistence",
      "steps": [{
        "name": "test",
        "tool": "test:echo",
        "inputs": {"message": "hello"}
      }]
    }
  }'
```

### Test 2: Fetch the Run (should not be empty)
```bash
# Replace RUN_ID with the ID from step 1
curl https://nofx-local-starter-volacci.vercel.app/api/runs/RUN_ID
```

### Test 3: List All Runs (should show your runs)
```bash
curl https://nofx-local-starter-volacci.vercel.app/api/runs
```

## 📊 Expected Behavior After Fix

**Before (broken):**
- Create run → Get 200 response
- Refresh page → Run is gone 👻
- Check database → Empty

**After (fixed):**
- Create run → Get 200 response ✅
- Refresh page → Run is still there ✅
- Check database → Run persists ✅
- Worker processes it → Run completes ✅

## 🔧 Environment Variables Summary

Your Vercel should now have:

```bash
DATABASE_URL=postgresql://...           ✅
QUEUE_DRIVER=postgres                   ✅
DATA_DRIVER=postgres                    ✅ NEW!
```

Your Railway should have (add DATA_DRIVER):

```bash
DATABASE_URL=postgresql://...           ✅
QUEUE_DRIVER=postgres                   ✅
DATA_DRIVER=postgres                    ⚠️ ADD THIS!
```

## 🐛 If Runs Still Disappear

1. **Check Vercel deployment logs** for errors
2. **Verify DATA_DRIVER is set:**
   ```bash
   vercel env ls | grep DATA_DRIVER
   ```
3. **Check the logs for storage driver:**
   - Should see: "Using database store"
   - Should NOT see: "Using filesystem store"

4. **Clear Vercel cache:**
   ```bash
   vercel --prod --force
   ```

## 📝 Technical Details

The issue was in `src/lib/store/StoreFactory.ts`:

```typescript
function getDataDriver(): string {
  return (
    process.env.DATA_DRIVER || 
    (process.env.QUEUE_DRIVER === 'memory' ? 'fs' : 'db')
  ).toLowerCase();
}
```

Without `DATA_DRIVER` explicitly set, it defaults based on `QUEUE_DRIVER`:
- If `QUEUE_DRIVER=memory` → Uses `'fs'` (filesystem)
- Otherwise → Uses `'db'` (database)

But Vercel serverless functions have ephemeral filesystems, so any data written to the filesystem is lost when the function ends.

**Solution:** Always explicitly set `DATA_DRIVER=postgres` for production deployments.

---

**Status:** Vercel is deploying now. Add DATA_DRIVER to Railway and test!
