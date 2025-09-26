# 🌩️ NOFX Cloud Testing Guide

This guide contains all commands and procedures for testing NOFX Control Plane in the cloud (Vercel deployment).

## Production URLs

- **Main Application**: https://nofx-control-plane.vercel.app
- **API Base**: https://nofx-control-plane.vercel.app/api
- **Health Check**: https://nofx-control-plane.vercel.app/health

## 🔐 Authentication Testing

### Sign Up New User
```bash
curl -X POST https://nofx-control-plane.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }'
```

### Login and Get Token
```bash
# Login and save token to variable
TOKEN=$(curl -X POST https://nofx-control-plane.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' | jq -r '.session.accessToken')

echo "Token: $TOKEN"
```

### Create API Key
```bash
curl -X POST https://nofx-control-plane.vercel.app/auth/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "scopes": ["read", "write"]
  }'
```

## 🚀 Run Management Testing

### Create a Run (Authenticated)
```bash
# Using JWT token
curl -X POST https://nofx-control-plane.vercel.app/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "Test cloud deployment",
      "steps": [{
        "name": "test-step",
        "tool": "codegen",
        "inputs": {
          "prompt": "Hello from the cloud!"
        }
      }]
    }
  }'

# Using API Key
curl -X POST https://nofx-control-plane.vercel.app/runs \
  -H "X-API-Key: nofx_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "Test with API key",
      "steps": [...]
    }
  }'
```

### Get Run Status
```bash
RUN_ID="your-run-id-here"
curl https://nofx-control-plane.vercel.app/runs/$RUN_ID \
  -H "Authorization: Bearer $TOKEN"
```

### List Your Runs
```bash
curl https://nofx-control-plane.vercel.app/runs \
  -H "Authorization: Bearer $TOKEN"
```

## 💰 Billing Testing

### Get Available Plans
```bash
curl https://nofx-control-plane.vercel.app/billing/plans
```

### Check Your Subscription
```bash
curl https://nofx-control-plane.vercel.app/billing/subscription \
  -H "Authorization: Bearer $TOKEN"
```

### Check Usage
```bash
curl https://nofx-control-plane.vercel.app/billing/usage \
  -H "Authorization: Bearer $TOKEN"
```

### Create Checkout Session
```bash
curl -X POST https://nofx-control-plane.vercel.app/billing/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_xxx_from_stripe"
  }'
```

### Access Customer Portal
```bash
curl -X POST https://nofx-control-plane.vercel.app/billing/portal \
  -H "Authorization: Bearer $TOKEN"
```

## 🔍 Health & Status Checks

### API Health
```bash
curl https://nofx-control-plane.vercel.app/health
```

### Queue Status (Admin Only)
```bash
curl https://nofx-control-plane.vercel.app/dev/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Worker Health (Admin Only)
```bash
curl https://nofx-control-plane.vercel.app/dev/worker/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 🧪 Complete Test Flow

Run this complete test to verify everything works:

```bash
# 1. Sign up
echo "Creating new user..."
curl -X POST https://nofx-control-plane.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"cloud-test@example.com","password":"CloudTest123!"}'

# 2. Login and get token
echo "Logging in..."
TOKEN=$(curl -s -X POST https://nofx-control-plane.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cloud-test@example.com","password":"CloudTest123!"}' \
  | jq -r '.session.accessToken')

echo "Got token: ${TOKEN:0:20}..."

# 3. Create a run
echo "Creating test run..."
RUN_RESPONSE=$(curl -s -X POST https://nofx-control-plane.vercel.app/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "Cloud deployment test",
      "steps": [{
        "name": "hello",
        "tool": "codegen",
        "inputs": {"prompt": "Say hello from the cloud!"}
      }]
    }
  }')

RUN_ID=$(echo $RUN_RESPONSE | jq -r '.id')
echo "Created run: $RUN_ID"

# 4. Check run status
echo "Checking run status..."
curl -s https://nofx-control-plane.vercel.app/runs/$RUN_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status'

# 5. Check usage
echo "Checking usage..."
curl -s https://nofx-control-plane.vercel.app/billing/usage \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## 🔧 Troubleshooting

### Common Issues

1. **"Authentication required" error**
   - Verify token is being sent correctly
   - Check token hasn't expired (tokens expire after 1 hour)
   - Ensure "Bearer " prefix is included

2. **CORS errors in browser**
   - API is configured for server-to-server calls
   - Use curl or Postman for testing
   - Or configure proper CORS headers in Vercel

3. **Rate limit exceeded**
   - Free tier: 10 requests/minute
   - Check your current tier with `/billing/subscription`
   - Upgrade if needed via `/billing/checkout`

4. **Webhook failures**
   - Check Vercel function logs: `vercel logs --prod`
   - Verify webhook secret in environment variables
   - Use Stripe CLI for local testing: `stripe listen --forward-to https://nofx-control-plane.vercel.app/api/webhooks/stripe`

## 📊 Monitoring

### View Vercel Logs
```bash
# Install Vercel CLI if needed
npm i -g vercel

# View production logs
vercel logs --prod

# View specific function logs
vercel logs api/auth/login --prod
```

### Check Supabase Status
- Dashboard: https://supabase.com/dashboard
- Check database connections
- Monitor auth users
- Review RLS policies

### Stripe Dashboard
- Live mode: https://dashboard.stripe.com
- Test mode: https://dashboard.stripe.com/test
- Check webhook events
- Monitor subscriptions

## 🚨 Emergency Commands

### Revoke All API Keys (User)
```bash
curl -X POST https://nofx-control-plane.vercel.app/auth/revoke-all-keys \
  -H "Authorization: Bearer $TOKEN"
```

### Cancel Subscription
```bash
curl -X POST https://nofx-control-plane.vercel.app/billing/cancel \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Account (GDPR)
```bash
curl -X DELETE https://nofx-control-plane.vercel.app/auth/account \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

## 🎯 Success Criteria

Your cloud deployment is working correctly if:
- ✅ Health check returns `{ "ok": true }`
- ✅ Authentication works (signup, login, tokens)
- ✅ Authenticated runs can be created
- ✅ Billing plans are displayed
- ✅ Usage tracking works
- ✅ Rate limiting is enforced
- ✅ Stripe webhooks are received

---

**Note**: All examples use the production URL `https://nofx-control-plane.vercel.app`. No localhost testing needed since everything runs in the cloud!