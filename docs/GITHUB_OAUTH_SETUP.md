# GitHub OAuth Setup Guide

## Overview

This guide explains how to configure GitHub OAuth for NOFX on **Vercel production**, enabling users to connect their GitHub accounts and select repositories directly from the UI.

## Prerequisites

- GitHub account
- **Supabase Cloud project** (required for production - local Supabase won't work with Vercel)
- NOFX application deployed on Vercel

## ⚠️ Important: Supabase Cloud Required

**Local Supabase will NOT work with GitHub OAuth on Vercel** because:
- OAuth callbacks must be publicly accessible
- Vercel deployments need a cloud-based auth provider
- Local Supabase (127.0.0.1) cannot receive OAuth callbacks from GitHub

**You MUST use Supabase Cloud for production deployments.**

## Step 1: Set Up Supabase Cloud

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Note your project URL: `https://xxxxx.supabase.co`
4. Go to **Settings > API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (for backend)

## Step 2: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details for **Vercel Production**:

   ```
   Application name: NOFX Production
   Homepage URL: https://nofx-local-starter-pmjvpbr44-volacci.vercel.app
   Authorization callback URL: https://xxxxx.supabase.co/auth/v1/callback
   ```

   **Replace:**
   - `nofx-local-starter-pmjvpbr44-volacci.vercel.app` with your actual Vercel domain
   - `xxxxx.supabase.co` with your actual Supabase project URL

4. Click **"Register application"**
5. Note down your **Client ID** and **Client Secret**

## Step 3: Configure Supabase GitHub Provider

1. Open your **Supabase Cloud project dashboard**
2. Navigate to **Authentication > Providers**
3. Find **GitHub** in the list
4. Toggle **Enable GitHub**
5. Enter your **Client ID** and **Client Secret** from Step 2
6. Add the following scopes (comma-separated):
   ```
   repo,read:user,user:email
   ```
7. The callback URL is automatically set to:
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
8. Click **Save**

**Important Scopes:**
- `repo` - Access to repositories (required for listing repos)
- `read:user` - Read user profile
- `user:email` - Read user email

## Step 4: Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add/Update these variables:

```bash
# Supabase Cloud (NOT local!)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend variables
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. **Redeploy** your Vercel app to apply changes

**Note:** GitHub OAuth credentials are stored in Supabase config, not in your app's environment variables. The app uses Supabase's `provider_token` to access GitHub APIs.

## Step 5: Test the Integration on Vercel

1. Open your Vercel deployment: `https://nofx-local-starter-pmjvpbr44-volacci.vercel.app`
2. Navigate to **Projects** page
3. Click **"Add from GitHub"** tab
4. Click **"Connect GitHub"** button
5. You should be redirected to GitHub authorization page
6. Grant permissions to NOFX
7. You'll be redirected back to your Vercel app
8. Your repositories should now appear in the dropdown selector!

**Success!** You can now browse and select GitHub repositories without any manual text input.

## Troubleshooting

### "Not connected to GitHub" after OAuth flow

**Problem:** User completes OAuth but `provider_token` is not available.

**Solution:** Ensure Supabase is requesting the `repo` scope:

1. In Supabase Dashboard: Authentication > Providers > GitHub
2. Add scopes: `repo,read:user,user:email`
3. Users must re-authenticate to get the updated scopes

### "Failed to fetch repositories" error

**Problem:** GitHub API returns 401 Unauthorized.

**Causes:**
- Token expired (GitHub tokens expire after 8 hours)
- Insufficient scopes
- Rate limiting

**Solution:**
- Implement token refresh logic
- Check scopes in GitHub OAuth app settings
- Cache repository data to reduce API calls

### OAuth callback redirects to wrong URL

**Problem:** After GitHub auth, user lands on wrong page or gets 404.

**Solution:**
1. Verify callback URL in GitHub OAuth app settings matches Supabase
2. Check `VITE_SUPABASE_URL` environment variable
3. Ensure OAuth callback handler exists at `/auth/callback`

### "Provider token not found" in session

**Problem:** `session.provider_token` is undefined.

**Solution:**
Supabase only returns `provider_token` if:
1. OAuth provider is properly configured
2. Correct scopes are requested
3. User granted permissions

Add this to your Supabase client configuration:
```typescript
const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true
  }
})
```

## Security Considerations

### Token Storage

- GitHub access tokens are stored in Supabase session (`provider_token`)
- Tokens are **not** stored in localStorage or cookies directly
- Tokens are encrypted by Supabase

### Token Expiration

- GitHub OAuth tokens expire after 8 hours
- Implement refresh logic or prompt user to re-authenticate
- Consider caching repository data with reasonable TTL

### Permissions

The `repo` scope grants full access to repositories. Consider:
- Only requesting `public_repo` if private repos aren't needed
- Implementing fine-grained permissions (GitHub Apps)
- Allowing users to revoke access anytime

## GitHub App vs OAuth App

### OAuth App (Current Implementation)
✅ Simple to set up
✅ Works with Supabase out of the box
❌ Coarse-grained permissions
❌ Tokens expire after 8 hours

### GitHub App (Recommended for Production)
✅ Fine-grained permissions
✅ Longer-lived tokens
✅ Webhooks support
❌ More complex setup

To migrate to GitHub App:
1. Create GitHub App at https://github.com/settings/apps
2. Configure installation permissions
3. Update Supabase to use GitHub App credentials
4. Implement installation token refresh

## Next Steps

1. ✅ GitHub OAuth integration complete
2. 🚧 Implement token refresh logic
3. 🚧 Add repository caching to reduce API calls
4. 🚧 Support GitHub App for production
5. 🚧 Add webhook support for repo changes

## Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Supabase Auth Providers](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub App vs OAuth App](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps)
