#!/bin/bash
# Export environment variables for Railway deployment
# Usage: bash scripts/export-env-for-railway.sh

echo "🚂 Railway Environment Variables"
echo "=================================="
echo ""
echo "Copy these to your Railway dashboard:"
echo ""

# Load from .env.vercel if it exists
if [ -f .env.vercel ]; then
  source .env.vercel
else
  echo "⚠️  .env.vercel not found. Run: vercel env pull .env.vercel"
  exit 1
fi

# Required variables
echo "# Required Core Variables"
echo "DATABASE_URL=$DATABASE_URL"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
echo ""

# Queue and storage configuration
echo "# Queue and Storage Configuration"
echo "QUEUE_DRIVER=postgres"
echo "DATA_DRIVER=postgres"
echo ""

# Worker configuration
echo "# Worker Configuration"
echo "NODE_ENV=production"
echo "LOG_LEVEL=info"
echo "STEP_TIMEOUT_MS=30000"
echo "HEALTH_CHECK_ENABLED=true"
echo ""

# AI API Keys
echo "# AI API Keys (if set)"
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
fi
if [ -n "$OPENAI_API_KEY" ]; then
  echo "OPENAI_API_KEY=$OPENAI_API_KEY"
fi
echo ""

echo "=================================="
echo "✅ Environment variables exported!"
echo ""
echo "Next steps:"
echo "1. Go to https://railway.app"
echo "2. Select your project"
echo "3. Go to Variables tab"
echo "4. Paste the variables above"
