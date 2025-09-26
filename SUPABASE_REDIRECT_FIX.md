# Fix Supabase Password Reset Redirect URL

## The Problem
The password reset emails are showing `localhost:3000` in the error message, even though our code is passing the correct production URL to Supabase.

## Root Cause
Supabase has its own **Redirect URLs** configuration in the Authentication settings that overrides what we pass in the API call.

## Solution

### 1. Go to Supabase Dashboard
1. Log in to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**

### 2. Update Redirect URLs
In the **Redirect URLs** section, add:
```
https://nofx-control-plane.vercel.app
https://nofx-control-plane.vercel.app/*
https://nofx-control-plane.vercel.app/#/reset-password
```

### 3. Update Site URL
In the **Site URL** field, change from:
```
http://localhost:3000
```
To:
```
https://nofx-control-plane.vercel.app
```

### 4. Save Changes
Click "Save" to update the configuration.

## Alternative: Set Environment Variable in Vercel

If you want to keep it flexible, you can also:

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - Name: `APP_URL`
   - Value: `https://nofx-control-plane.vercel.app`
4. Redeploy the project

## Testing
After making these changes, test the password reset flow:
1. Request a password reset
2. Check that the email contains the correct production URL
3. Verify the link works and redirects to `https://nofx-control-plane.vercel.app/#/reset-password`

## Note
The error message you're seeing (`localhost:3000`) comes from Supabase's default configuration, not from our code. Our code is correctly trying to use the production URL, but Supabase's authentication settings are overriding it.