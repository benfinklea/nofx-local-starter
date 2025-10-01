# GitHub OAuth Setup Checklist (Vercel Production)

## ✅ Quick Setup Guide - NO LOCALHOST!

### Step 1: Supabase Cloud Setup
- [ ] Create Supabase Cloud project at https://supabase.com/dashboard
- [ ] Copy your project URL (e.g., `https://xxxxx.supabase.co`)
- [ ] Copy your `anon` key from Settings > API
- [ ] Copy your `service_role` key from Settings > API

### Step 2: GitHub OAuth App
- [ ] Go to https://github.com/settings/developers
- [ ] Click "New OAuth App"
- [ ] Fill in:
  - **Application name:** NOFX Production
  - **Homepage URL:** `https://nofx-local-starter-pmjvpbr44-volacci.vercel.app` (your Vercel domain)
  - **Authorization callback URL:** `https://xxxxx.supabase.co/auth/v1/callback` (your Supabase project URL)
- [ ] Click "Register application"
- [ ] Copy **Client ID** and **Client Secret**

### Step 3: Configure Supabase GitHub Provider
- [ ] Open Supabase dashboard > Authentication > Providers
- [ ] Find GitHub and toggle "Enable"
- [ ] Paste **Client ID** and **Client Secret**
- [ ] Add scopes: `repo,read:user,user:email`
- [ ] Click **Save**

### Step 4: Update Vercel Environment Variables
- [ ] Go to Vercel dashboard > Your Project > Settings > Environment Variables
- [ ] Add/Update these variables:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] Click **Redeploy** to apply changes

### Step 5: Test
- [ ] Open your Vercel app: https://nofx-local-starter-pmjvpbr44-volacci.vercel.app
- [ ] Go to Projects page
- [ ] Click "Add from GitHub" tab
- [ ] Click "Connect GitHub"
- [ ] Authorize on GitHub
- [ ] See your repositories! ✨

## 🎯 What You Get

After setup, users can:
1. Click "Connect GitHub" button
2. Authorize once
3. Browse all their repositories in a dropdown
4. Select repository
5. Select branch
6. Click "Add Project from GitHub"
7. Done! Project ready to use

**No more manual text input. No more localhost. Pure cloud magic.** ☁️

## 🔧 Your Current Deployment

- **Vercel URL:** https://nofx-local-starter-pmjvpbr44-volacci.vercel.app
- **Supabase:** Need to set up cloud project
- **GitHub OAuth:** Ready to configure

## 📚 Full Documentation

See `docs/GITHUB_OAUTH_SETUP.md` for detailed troubleshooting and advanced configuration.
