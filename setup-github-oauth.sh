#!/bin/bash
set -e

echo "🚀 NOFX GitHub OAuth Setup Script"
echo "=================================="
echo ""

# Your Supabase project details
SUPABASE_PROJECT_REF="pacxtzdgbzwzdyjebzgp"
SUPABASE_URL="https://pacxtzdgbzwzdyjebzgp.supabase.co"
VERCEL_URL="https://nofx-local-starter-pmjvpbr44-volacci.vercel.app"
CALLBACK_URL="${SUPABASE_URL}/auth/v1/callback"

echo "📋 Your Configuration:"
echo "   Supabase Project: nofx"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Vercel URL: $VERCEL_URL"
echo "   OAuth Callback: $CALLBACK_URL"
echo ""

# Step 1: GitHub OAuth App
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 STEP 1: Create GitHub OAuth App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Unfortunately, GitHub CLI doesn't support creating OAuth apps."
echo "You need to do this manually (takes 30 seconds):"
echo ""
echo "1. Open this URL in your browser:"
echo "   👉 https://github.com/settings/applications/new"
echo ""
echo "2. Fill in the form with these EXACT values:"
echo ""
echo "   Application name:     NOFX Production"
echo "   Homepage URL:         $VERCEL_URL"
echo "   Callback URL:         $CALLBACK_URL"
echo ""
echo "3. Click 'Register application'"
echo ""
echo "4. Copy the Client ID and Client Secret"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Press ENTER when you've created the OAuth app and have your credentials ready..."

echo ""
read -p "Paste your GitHub Client ID: " GITHUB_CLIENT_ID
read -sp "Paste your GitHub Client Secret (hidden): " GITHUB_CLIENT_SECRET
echo ""
echo ""

if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo "❌ Error: Client ID and Secret are required"
    exit 1
fi

echo "✅ GitHub credentials received"
echo ""

# Step 2: Configure Supabase
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  STEP 2: Configuring Supabase GitHub Provider"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Enable GitHub provider via Supabase Management API
echo "Enabling GitHub OAuth provider..."

# Note: This uses the Supabase Management API
# We need to use the service role key or personal access token
SUPABASE_ACCESS_TOKEN=$(supabase projects api-keys --project-ref "$SUPABASE_PROJECT_REF" | grep "default" | grep "sb_secret" | awk '{print $3}')

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  Could not get Supabase access token automatically."
    echo "Please configure GitHub provider manually:"
    echo ""
    echo "1. Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/providers"
    echo "2. Find 'GitHub' and toggle it ON"
    echo "3. Paste:"
    echo "   Client ID: $GITHUB_CLIENT_ID"
    echo "   Client Secret: $GITHUB_CLIENT_SECRET"
    echo "4. Add scopes: repo,read:user,user:email"
    echo "5. Click Save"
    echo ""
    read -p "Press ENTER when you've configured it in the dashboard..."
else
    echo "⚠️  Note: Supabase CLI doesn't directly support auth provider config."
    echo "Opening Supabase dashboard for manual configuration..."
    echo ""
    open "https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/providers" 2>/dev/null || echo "Open this URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/providers"
    echo ""
    echo "In the dashboard:"
    echo "  1. Find 'GitHub' and toggle it ON"
    echo "  2. Paste Client ID: $GITHUB_CLIENT_ID"
    echo "  3. Paste Client Secret: $GITHUB_CLIENT_SECRET"
    echo "  4. Add scopes: repo,read:user,user:email"
    echo "  5. Click Save"
    echo ""
    read -p "Press ENTER when done..."
fi

echo "✅ Supabase GitHub provider configured"
echo ""

# Step 3: Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 STEP 3: Test the Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening your Vercel app..."
open "${VERCEL_URL}/projects" 2>/dev/null || echo "Open this URL: ${VERCEL_URL}/projects"
echo ""
echo "To test:"
echo "  1. Click 'Add from GitHub' tab"
echo "  2. Click 'Connect GitHub' button"
echo "  3. Authorize on GitHub"
echo "  4. You should see your repositories!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your NOFX app now has GitHub OAuth integration! 🎉"
echo ""
echo "If you have any issues, check:"
echo "  - GitHub OAuth app callback URL matches: $CALLBACK_URL"
echo "  - Supabase GitHub provider has scopes: repo,read:user,user:email"
echo "  - Vercel environment variables are set correctly"
echo ""
