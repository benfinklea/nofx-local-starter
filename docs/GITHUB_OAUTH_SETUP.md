# GitHub OAuth Setup Guide

## Overview

This guide explains how to configure GitHub OAuth for NOFX, enabling users to connect their GitHub accounts and select repositories directly from the UI.

## Prerequisites

- GitHub account
- Supabase project (local or cloud)
- NOFX application running

## Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"** (or "New GitHub App" for more features)
3. Fill in the application details:

   **For Development (Local Supabase):**
   ```
   Application name: NOFX Local Dev
   Homepage URL: http://localhost:5173
   Authorization callback URL: http://127.0.0.1:54321/auth/v1/callback
   ```

   **For Production (Supabase Cloud):**
   ```
   Application name: NOFX
   Homepage URL: https://your-domain.com
   Authorization callback URL: https://your-supabase-project.supabase.co/auth/v1/callback
   ```

4. Click **"Register application"**
5. Note down your **Client ID** and **Client Secret**

## Step 2: Configure Supabase

### Local Development (Supabase CLI)

1. Open `supabase/config.toml` in your project
2. Add GitHub provider configuration:

```toml
[auth.external.github]
enabled = true
client_id = "your_github_client_id"
secret = "your_github_client_secret"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```

3. Restart Supabase:
```bash
supabase stop
supabase start
```

### Production (Supabase Dashboard)

1. Open your Supabase project dashboard
2. Navigate to **Authentication > Providers**
3. Find **GitHub** in the list
4. Toggle **Enable GitHub**
5. Enter your **Client ID** and **Client Secret**
6. The callback URL is automatically set to:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
7. Click **Save**

## Step 3: Update Environment Variables

Add to your `.env` file:

```bash
# GitHub OAuth (optional - only needed for custom GitHub API usage)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Note:** When using Supabase OAuth, the client credentials are stored in Supabase config, not in your app's `.env`. The app uses Supabase's provider token to access GitHub APIs.

## Step 4: Configure GitHub OAuth Scopes

By default, Supabase requests minimal GitHub permissions. To access repositories, you need to request additional scopes.

In your Supabase config or dashboard, add the following scopes:

```
repo          # Access to public and private repositories
read:user     # Read user profile data
user:email    # Read user email addresses
```

## Step 5: Test the Integration

1. Start your NOFX application
2. Navigate to **Projects** page
3. Click **"Add from GitHub"** tab
4. Click **"Connect GitHub"**
5. You should be redirected to GitHub authorization
6. Grant permissions
7. You'll be redirected back to NOFX
8. Your repositories should now appear in the dropdown

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
