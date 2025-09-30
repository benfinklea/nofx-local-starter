# Modern Authentication Implementation

## Overview

This document describes the production-grade authentication system implemented using `@supabase/ssr`. This replaces the old localStorage-based authentication with secure, cookie-based sessions that work reliably in serverless environments.

## Architecture

### Key Components

1. **Supabase Client Factories** (`src/lib/supabase/`)
   - `client.ts` - Browser client for React components
   - `server.ts` - Server client for API routes
   - `middleware.ts` - Middleware client for token refresh

2. **Auth Service** (`src/lib/auth.ts`)
   - Singleton service for authentication operations
   - Email/password, OAuth, magic links
   - Session management

3. **Middleware** (`middleware.ts`)
   - Automatic token refresh on every request
   - Runs on edge runtime for performance
   - Prevents "session expired" errors

4. **API Routes** (`api/auth/`)
   - `login.ts` - Email/password authentication
   - `callback.ts` - PKCE code exchange for OAuth/magic links
   - `auth-middleware.ts` - Protected endpoint wrapper

## Security Features

### ✅ What We Fixed

1. **No more localStorage** - Cookies are HTTP-only, preventing XSS attacks
2. **Server-side validation** - Always use `getUser()` not `getSession()`
3. **PKCE flow** - Modern OAuth standard for secure code exchange
4. **Automatic token refresh** - Middleware refreshes tokens before expiry
5. **Secure cookie attributes** - HttpOnly, Secure, SameSite=Lax

### 🔒 Security Best Practices

- **Never expose service_role key** in client code
- **Always use getUser()** on server (validates JWT with auth server)
- **HTTP-only cookies** prevent JavaScript access
- **PKCE** for OAuth prevents authorization code interception

## Usage Examples

### Frontend (React)

```typescript
import { auth } from './lib/auth';

// Sign up
const result = await auth.signup('user@example.com', 'password123', 'Full Name');
if (result.error) {
  console.error(result.error);
} else {
  console.log('Signed up:', result.user);
}

// Login
const result = await auth.login('user@example.com', 'password123');
if (result.error) {
  console.error(result.error);
} else {
  console.log('Logged in:', result.user);
}

// Logout
await auth.logout();

// Check authentication
const isAuth = await auth.isAuthenticated();

// Listen to auth changes
const unsubscribe = auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
// Later: unsubscribe()

// OAuth
await auth.signInWithOAuth('google');

// Magic link
await auth.signInWithMagicLink('user@example.com');
```

### API Routes (Vercel Functions)

```typescript
import { withAuth } from './auth-middleware';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Protected endpoint
export default withAuth(async (req, res, user) => {
  // user is automatically validated
  return res.json({
    message: `Hello ${user.email}!`
  });
});
```

### Manual Authentication Check

```typescript
import { verifyAuth } from './auth-middleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authResult = await verifyAuth(req);

  if ('error' in authResult) {
    return res.status(401).json({ error: authResult.error });
  }

  const user = authResult.user;
  // ... protected logic
}
```

## Environment Variables

### Required Variables

All environments need these variables with different prefixes:

```bash
# Backend (Node.js)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server only!

# Frontend (Vite)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Frontend (Next.js compatibility)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Local Development

`.env` and `apps/frontend/.env.development`:
```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGci...  # Local Supabase demo key
```

### Production

`.env.local` or Vercel environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  # Production anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Server-side only
```

## Supabase Dashboard Configuration

### 1. Redirect URLs

Navigate to **Authentication** → **URL Configuration**:

```
Site URL: https://nofx-control-plane.vercel.app

Additional Redirect URLs:
- http://localhost:3000/auth/callback
- http://localhost:5173/auth/callback
- https://nofx-control-plane.vercel.app/auth/callback
```

### 2. Email Templates

Update email templates with production URLs:
```
Reset Password URL: {{ .SiteURL }}/reset-password?token={{ .Token }}
Confirmation URL: {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
```

### 3. Enable PKCE (Recommended)

In **Authentication** → **Settings**:
- ✅ Enable PKCE flow
- ✅ Disable session persistence (we handle via cookies)

## Testing

### Unit Tests

```bash
cd apps/frontend
npm run test tests/auth.test.ts
```

Tests cover:
- Signup (success, errors, email confirmation)
- Login (success, invalid credentials, network errors)
- Logout
- Password reset
- Password update
- Session management
- OAuth initiation
- Magic links

### E2E Tests

```bash
npm run test:e2e
```

Tests cover:
- Complete login flow
- Session persistence across reloads
- Logout flow
- Signup flow
- Password reset flow
- Protected routes
- Automatic token refresh
- API authentication headers

## Migration from Old System

### What Changed

| Old System | New System |
|------------|-----------|
| localStorage | HTTP-only cookies |
| Manual JWT handling | Automatic via @supabase/ssr |
| No token refresh | Middleware auto-refresh |
| No PKCE | PKCE by default |
| createClient() | createBrowserClient() / createServerClient() |
| getSession() everywhere | getUser() on server, getSession() on client |

### Breaking Changes

1. **Auth service API is similar** - Most methods work the same
2. **Cookies replace localStorage** - Sessions now in cookies
3. **Middleware required** - Add `middleware.ts` for auto-refresh
4. **Callback route required** - `/api/auth/callback` for PKCE
5. **Environment variables** - Add VITE_* and NEXT_PUBLIC_* prefixes

## Troubleshooting

### "Missing Supabase environment variables"

**Solution:** Add all three prefixes to your .env files:
```bash
SUPABASE_URL=...
VITE_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
```

### Session not persisting across reloads

**Cause:** Middleware not running or cookies not being set

**Solution:**
1. Check `middleware.ts` exists in `apps/frontend/`
2. Verify cookie headers in Network tab
3. Ensure HTTPS in production (cookies require Secure flag)

### "Invalid or expired token" on every request

**Cause:** Using `getSession()` instead of `getUser()` on server

**Solution:** Always use `getUser()` in API routes and server-side code

### OAuth callback not working

**Cause:** Missing callback route or incorrect redirect URL

**Solution:**
1. Verify `/api/auth/callback.ts` exists
2. Add exact callback URL to Supabase dashboard
3. Check for trailing slash mismatch

### CORS errors in development

**Cause:** Frontend and API on different ports

**Solution:** Use Vite proxy in `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

## Performance

### Middleware Optimization

The middleware is configured to skip static files:

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

### Token Refresh Timing

- JWT expires after 1 hour (default)
- Middleware refreshes 10 seconds before expiry
- Refresh tokens valid for 30 days

## Production Checklist

- [ ] Environment variables set in Vercel
- [ ] Redirect URLs configured in Supabase
- [ ] Email templates updated with production URLs
- [ ] PKCE enabled in Supabase
- [ ] RLS policies enabled on all tables
- [ ] Service role key NOT in client code
- [ ] HTTPS enforced (cookies require Secure flag)
- [ ] Rate limiting configured
- [ ] Email SMTP configured (not using Supabase default)
- [ ] E2E tests passing
- [ ] Manual smoke test of login/logout flow

## Additional Resources

- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [PKCE Flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

## Support

For issues with this implementation:
1. Check troubleshooting section above
2. Review Supabase logs in dashboard
3. Check Vercel function logs
4. Verify environment variables are set correctly