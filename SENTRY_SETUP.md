# 🚨 Sentry Error Tracking Setup

## Why Sentry?

**Without Sentry:** You only know about production errors when:
- Users report them (hours/days later)
- You manually check Vercel logs
- The error is severe enough to notice

**With Sentry:** You know within seconds:
- What error occurred
- How many users affected
- Full stack trace with variable values
- Session replay showing what user did
- Which release introduced the bug

---

## Quick Setup (15 minutes)

### Step 1: Create Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up with GitHub (easiest)
3. Create new project:
   - Platform: **Node.js** (for backend)
   - Project name: **nofx-control-plane**
4. Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

### Step 2: Install Sentry

```bash
# Backend
npm install @sentry/node @sentry/profiling-node

# Frontend
cd apps/frontend
npm install @sentry/react
cd ../..
```

### Step 3: Add Environment Variables

Add to Vercel → Project Settings → Environment Variables:

```bash
# Sentry DSN (get from Sentry dashboard)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Frontend DSN (can be same as backend or separate)
VITE_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Auth token for source maps (get from Sentry → Settings → Auth Tokens)
SENTRY_AUTH_TOKEN=sntrys_xxxxx
```

### Step 4: Backend Integration

Create `src/lib/sentry.ts`:

```typescript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping error tracking');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions

    // Profiling
    profilesSampleRate: 0.1,
    integrations: [
      new ProfilingIntegration(),
    ],

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // Don't send errors in development
    enabled: process.env.NODE_ENV === 'production',
  });

  console.log('✅ Sentry initialized');
}
```

Add to `src/api/main.ts`:

```typescript
import { initSentry } from './lib/sentry';
import * as Sentry from "@sentry/node";

// Initialize Sentry first
initSentry();

// ... your app setup ...

// Add Sentry error handler (MUST be after all routes)
app.use(Sentry.Handlers.errorHandler());
```

### Step 5: Frontend Integration

Update `apps/frontend/src/main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

// Initialize Sentry
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    tracesSampleRate: 0.1,

    // Session replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when error occurs

    // Don't send in development
    enabled: import.meta.env.PROD,
  });
}

// Wrap your app in ErrorBoundary
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
```

### Step 6: Test It Works

**Backend test:**
```typescript
// Add to any API endpoint temporarily
throw new Error('Test Sentry error - backend');
```

**Frontend test:**
```typescript
// Add to any component temporarily
throw new Error('Test Sentry error - frontend');
```

Visit the endpoint/component, then check Sentry dashboard - you should see the error within seconds!

---

## Features to Enable

### 1. Slack/Email Alerts

Sentry → Settings → Alerts → New Alert Rule:
- **Condition:** When an event occurs
- **Filter:** All errors
- **Action:** Send notification to Slack/Email
- **Frequency:** Immediately

### 2. Release Tracking

Automatically tracks which deploy introduced bugs.

Already configured via `release: process.env.VERCEL_GIT_COMMIT_SHA`

### 3. Session Replay

See exactly what user did before error occurred.

Already configured in frontend with `replayIntegration()`

### 4. Source Maps

See original source code in stack traces (not minified).

Add to `vercel.json`:
```json
{
  "build": {
    "env": {
      "SENTRY_AUTH_TOKEN": "@sentry-auth-token"
    }
  }
}
```

Add to `apps/frontend/vite.config.ts`:
```typescript
import { sentryVitePlugin } from "@vite-plugin-sentry/vite";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "your-org",
      project: "nofx-control-plane",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

---

## What Sentry Captures

### Automatically:
- ✅ Unhandled exceptions
- ✅ Unhandled promise rejections
- ✅ API performance (slow endpoints)
- ✅ Database query performance
- ✅ User context (anonymized)
- ✅ Breadcrumbs (user actions leading to error)

### Manually:
```typescript
// Capture custom errors
Sentry.captureException(error);

// Capture messages
Sentry.captureMessage('Something unexpected happened');

// Add custom context
Sentry.setContext("run", {
  id: runId,
  status: runStatus,
});

// Add user context
Sentry.setUser({
  id: userId,
  email: userEmail, // Optional - consider privacy
});
```

---

## Viewing Errors

### Sentry Dashboard:

1. **Issues** - List of all errors, grouped by type
   - Click issue → See all occurrences
   - See affected users count
   - See first/last occurrence
   - Mark as resolved

2. **Performance** - Slow endpoints/queries
   - See p50, p75, p95, p99 response times
   - Identify slowest transactions
   - See query times

3. **Releases** - Track errors by deploy
   - See which release introduced bug
   - Compare error rates between releases
   - See commit that caused issue

4. **Replays** - Video-like playback of user session
   - See what user clicked
   - See network requests
   - See console logs
   - See exact steps to reproduce

---

## Cost

**Free Tier:**
- 5,000 errors/month
- 10,000 performance events/month
- 50 session replays/month
- Unlimited team members

**Should be enough for small-medium projects.**

If you exceed:
- Paid plan starts at $26/month
- Or selectively disable features (turn off replays, reduce sampling)

---

## Privacy & Security

**Data Sentry collects:**
- Error messages and stack traces
- Request URLs and headers
- User IDs (if you set them)
- Session replay videos

**Sensitive data protection:**

```typescript
Sentry.init({
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    // Scrub URLs with tokens
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/token=[^&]+/, 'token=REDACTED');
    }

    return event;
  },
});
```

---

## Next Steps

1. [ ] Sign up for Sentry
2. [ ] Install packages
3. [ ] Add SENTRY_DSN to Vercel
4. [ ] Add backend integration
5. [ ] Add frontend integration
6. [ ] Test with dummy error
7. [ ] Set up Slack alerts
8. [ ] Enable source maps

**Time investment:** 15-30 minutes
**Time saved:** Hours per production incident

---

## Alternative: Free Self-Hosted

If you want to avoid Sentry costs:

**GlitchTip** - Open source Sentry alternative
- Self-host on Vercel/Railway/Fly.io
- Sentry-compatible API (use same SDKs)
- Free if you host it yourself

But Sentry's free tier is usually enough for small projects, and their UI is much better.
