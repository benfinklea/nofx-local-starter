# 🚀 NOFX SaaS Setup Guide

## Overview

NOFX Control Plane has been upgraded with enterprise-grade authentication and billing capabilities:

- ✅ **Supabase Auth** - Secure user authentication with JWT
- ✅ **Stripe Billing** - Subscription management and payments
- ✅ **Rate Limiting** - Tier-based API limits
- ✅ **Usage Tracking** - Monitor and bill for resource consumption
- ✅ **Row Level Security** - User data isolation
- ✅ **API Keys** - Programmatic access for automation

## 🔒 Security Improvements

### What Was Fixed

**CRITICAL VULNERABILITY PATCHED**: The system was completely open - anyone could create runs and access all data without authentication!

### Now Protected

- `POST /runs` - Requires authentication
- `GET /runs` - Shows only user's runs
- `GET /runs/:id` - Validates ownership
- All `/dev/*` endpoints - Admin only
- Stripe webhooks - Signature verified
- Rate limiting per user tier

## 📋 Quick Start

### 1. Prerequisites

- Node.js 20+ and npm
- Supabase account (free tier works)
- Stripe account (test mode for development)
- Vercel account for deployment

### 2. Database Setup

1. **Create Supabase Project**
   ```bash
   # Go to https://supabase.com
   # Create new project
   # Note your project URL and keys
   ```

2. **Run Migration**
   ```bash
   # In Supabase SQL Editor, run:
   supabase/migrations/20241225001000_auth_billing_system.sql
   ```

### 3. Stripe Setup

1. **Create Products & Prices**
   ```bash
   # In Stripe Dashboard:
   # 1. Go to Products
   # 2. Create pricing tiers:
   #    - Free: $0/month
   #    - Starter: $29/month
   #    - Pro: $99/month
   #    - Enterprise: Custom
   ```

2. **Configure Webhook**
   ```bash
   # Add endpoint: https://your-domain.vercel.app/api/webhooks/stripe
   # Select events:
   - checkout.session.completed
   - customer.subscription.*
   - invoice.payment_succeeded
   - invoice.payment_failed
   - product.*
   - price.*
   ```

### 4. Environment Variables

```bash
# Copy template
cp .env.saas.example .env

# Required variables:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# For local development:
# APP_URL=http://localhost:3000
# For production (Vercel):
APP_URL=https://nofx-control-plane.vercel.app
```

### 5. Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Test auth (production)
curl -X POST https://nofx-control-plane.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 6. Deploy to Vercel

```bash
# Deploy
vercel --prod

# Set environment variables in Vercel Dashboard
# Project Settings → Environment Variables
```

## 🎯 API Usage

### Authentication

**Sign Up**
```bash
POST /auth/signup
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe"
}
```

**Login**
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Create API Key**
```bash
POST /auth/api-keys
Authorization: Bearer {token}
{
  "name": "Production Key",
  "scopes": ["read", "write"]
}
```

### Protected Endpoints

**Create Run** (Now Protected!)
```bash
POST /runs
Authorization: Bearer {token}
# or
X-API-Key: nofx_live_...

{
  "plan": {
    "goal": "Generate code",
    "steps": [...]
  }
}
```

### Billing

**Start Subscription**
```bash
POST /billing/checkout
Authorization: Bearer {token}
{
  "priceId": "price_xxx"
}
# Returns Stripe Checkout URL
```

**Manage Billing**
```bash
POST /billing/portal
Authorization: Bearer {token}
# Returns Stripe Portal URL
```

## 📊 Subscription Tiers

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Runs/month | 10 | 100 | 1000 | Unlimited |
| API calls/month | 100 | 5000 | 50000 | Unlimited |
| Rate limit | 10/min | 30/min | 60/min | 200/min |
| Team members | 1 | 3 | 10 | Unlimited |
| GitHub integration | ❌ | ✅ | ✅ | ✅ |
| Custom models | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ |

## 🔧 Troubleshooting

### Common Issues

1. **"Authentication required" error**
   - Ensure you're sending JWT token or API key
   - Check token expiration

2. **"Usage limit exceeded"**
   - Check `/billing/usage` for current usage
   - Upgrade subscription at `/billing/portal`

3. **Stripe webhook failures**
   - Verify webhook secret is correct
   - Check Vercel function logs

4. **Database connection errors**
   - Verify DATABASE_URL is correct
   - Check Supabase service status

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  Vercel API     │
│   (Frontend)    │     │   Functions     │
└─────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼────────┐   ┌───────▼────────┐
            │  Supabase      │   │   Stripe       │
            │  (Auth + DB)   │   │  (Billing)     │
            └────────────────┘   └────────────────┘
```

## 📝 Migration from Old System

### For Existing Users

1. **Create accounts** - All users need to sign up
2. **Migrate data** - Runs will be associated with user accounts
3. **Get API keys** - Replace any hardcoded access with API keys
4. **Update integrations** - Add authentication headers

### Breaking Changes

- All API endpoints now require authentication
- Run IDs are now scoped to users
- Rate limits apply based on subscription tier

## 🚨 Security Best Practices

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY`
2. **Rotate API keys** regularly
3. **Use environment variables** for all secrets
4. **Enable RLS** on all tables
5. **Validate webhooks** with signatures
6. **Implement CORS** properly
7. **Use HTTPS** in production

## 📚 Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [Vercel Deployment](https://vercel.com/docs)
- [NOFX API Reference](./docs/control-plane/API_REFERENCE.md)

## 🤝 Support

- **Issues**: https://github.com/your-repo/issues
- **Email**: support@your-domain.com
- **Discord**: https://discord.gg/your-server

---

## ⚡ Quick Test

After setup, test the full flow:

```bash
# 1. Sign up
curl -X POST https://nofx-control-plane.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!"}'

# 2. Login (get token)
TOKEN=$(curl -X POST https://nofx-control-plane.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!"}' \
  | jq -r '.session.accessToken')

# 3. Create a run (NOW REQUIRES AUTH!)
curl -X POST https://nofx-control-plane.vercel.app/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "Test authenticated run",
      "steps": [{
        "name": "test",
        "tool": "codegen",
        "inputs": {"prompt": "Hello World"}
      }]
    }
  }'

# 4. Check usage
curl https://nofx-control-plane.vercel.app/billing/usage \
  -H "Authorization: Bearer $TOKEN"
```

## 🎉 Success!

Your NOFX Control Plane is now:
- ✅ Secured with authentication
- ✅ Ready for billing
- ✅ Protected against abuse
- ✅ Enterprise-ready

Ship it! 🚀