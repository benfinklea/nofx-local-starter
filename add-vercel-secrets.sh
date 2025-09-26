#!/bin/bash

# Script to add Vercel environment variables
echo "Adding Vercel environment variables..."

# Database URL
echo "postgresql://postgres.pacxtzdgbzwzdyjebzgp:zisfUw-2carge-dewtet@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1" | vercel env add DATABASE_URL production

# Supabase URL
echo "https://pacxtzdgbzwzdyjebzgp.supabase.co" | vercel env add SUPABASE_URL production

# Queue driver
echo "postgres" | vercel env add QUEUE_DRIVER production

# Generate JWT secret
echo "$(openssl rand -base64 32)" | vercel env add JWT_SECRET production

echo "Basic secrets added!"
echo ""
echo "Now you need to add these manually via Vercel dashboard:"
echo "1. Go to: https://vercel.com/ben-finkleas-projects/redis-worker-fix/settings/environment-variables"
echo ""
echo "2. Add your Supabase keys from:"
echo "   https://supabase.com/dashboard/project/pacxtzdgbzwzdyjebzgp/settings/api"
echo "   - SUPABASE_ANON_KEY = (copy the anon public key)"
echo "   - SUPABASE_SERVICE_ROLE_KEY = (copy the service_role secret key)"
echo ""
echo "3. Add your AI API keys:"
echo "   - OPENAI_API_KEY = (your OpenAI key)"
echo "   - ANTHROPIC_API_KEY = (your Anthropic key)"
echo ""
echo "After adding these, run: vercel --prod"