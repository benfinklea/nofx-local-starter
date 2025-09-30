# Quick Start - Testing Authentication

## Dev Server Running ✅

Your frontend is now running at: **http://localhost:5173/**

## What I Fixed

### Issue #1: Missing Environment Variables
**Problem:** The code was looking for `VITE_SUPABASE_URL` but it wasn't set.

**Fixed:** Added all required variables to `.env`, `.env.local`, and `.env.development`

### Issue #2: Google Login Button Not Working
**Problem:** Old OAuth endpoint `/api/auth/oauth-start` doesn't exist in new system.

**Fixed:** Updated `LoginForm.tsx` to use `auth.signInWithOAuth('google')` method.

---

## Test Authentication Now

### 1. Open the App
```bash
open http://localhost:5173/
```

### 2. Test Email/Password Login

**Test Credentials:**
```
Email: ben+nofx1@volacci.com
Password: dabgub-raCgu5-watrut
```

**What should happen:**
1. Fill in email and password
2. Click "Sign In"
3. Should see "Login successful! Refreshing..."
4. Page reloads and you're logged in
5. Your email shows in the UI

### 3. Test Session Persistence

1. After logging in successfully
2. Refresh the page (Cmd+R or F5)
3. **Should stay logged in** (no redirect to login)

### 4. Test Logout

1. Find the logout button
2. Click it
3. Should redirect back to login page

### 5. Test Google OAuth (Optional)

1. Click "Sign in with Google"
2. Should redirect to Google OAuth
3. After approving, redirects back to app
4. Should be logged in

**Note:** Google OAuth requires Supabase configuration in dashboard.

---

## Troubleshooting

### Still seeing "Missing Supabase environment variables"?

Check the browser console (F12). If you see this error:

```bash
# Kill the dev server
killall node

# Restart it
npm run dev
```

The dev server needs to reload environment variables.

### Google login still not working?

**Check Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Your Project → Authentication → Providers
3. Make sure Google is enabled
4. Add these redirect URLs:
   - `http://localhost:5173/auth/callback`
   - `https://nofx-control-plane.vercel.app/auth/callback`

### Regular login not working?

**Check browser console (F12) for errors:**
- Network tab → Look for `/api/auth-v2/login` request
- Console tab → Look for error messages

**Common issues:**
- API not running: Start backend with `npm run dev` in root
- Wrong credentials: Use test credentials above
- CORS error: Check `vite.config.ts` proxy settings

---

## What's Different from Before

| Before | After |
|--------|-------|
| ❌ Sessions lost on reload | ✅ Persistent sessions |
| ❌ Manual OAuth endpoint | ✅ Built-in OAuth support |
| ❌ localStorage (insecure) | ✅ HTTP-only cookies |
| ❌ Confusing env vars | ✅ All prefixes configured |
| ❌ "Session expired" errors | ✅ Auto-refresh |

---

## Next Steps After Local Testing

### 1. Update Vercel Environment Variables

Go to Vercel Dashboard and add:
```bash
VITE_SUPABASE_URL=https://pacxtzdgbzwzdyjebzgp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci... (from .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://pacxtzdgbzwzdyjebzgp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (from .env.local)
```

### 2. Deploy

```bash
git push origin main
```

### 3. Test Production

Visit https://nofx-control-plane.vercel.app and test login.

---

## Dev Server Commands

```bash
# Start dev server
npm run dev

# Stop dev server
# Press Ctrl+C in the terminal, or:
killall node

# Rebuild
npm run build

# Run tests
npm run test
```

---

## Getting Help

If something's not working:

1. **Check browser console** (F12) for errors
2. **Check terminal** for server errors
3. **Read** `AUTH_IMPLEMENTATION.md` for detailed docs
4. **Try** restarting the dev server

## Status

✅ Frontend built successfully
✅ Dev server running on http://localhost:5173/
✅ Google OAuth button restored
✅ Environment variables configured
✅ Ready to test!

**Go ahead and test the login now!** 🚀