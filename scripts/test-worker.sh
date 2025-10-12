#!/bin/bash
# Test Worker Diagnostic Script
# Tests if the Vercel worker endpoint is accessible and functioning

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 NOFX Worker Diagnostic"
echo "=========================="
echo ""

# Get the Vercel URL
VERCEL_URL="${VERCEL_URL:-}"
if [ -z "$VERCEL_URL" ]; then
  echo -e "${YELLOW}⚠️  VERCEL_URL not set, trying to detect...${NC}"
  VERCEL_URL=$(vercel ls 2>/dev/null | grep "nofx" | head -1 | awk '{print $2}')
fi

if [ -z "$VERCEL_URL" ]; then
  echo -e "${RED}❌ Could not detect Vercel URL. Please set VERCEL_URL environment variable${NC}"
  echo "   Example: export VERCEL_URL=https://your-app.vercel.app"
  exit 1
fi

echo -e "${GREEN}✓${NC} Using Vercel URL: $VERCEL_URL"
echo ""

# Test 1: Check if worker endpoint exists
echo "Test 1: Checking worker endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL/api/worker" || echo "000")

if [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}✓${NC} Worker endpoint exists (got 401 Unauthorized - expected without auth)"
elif [ "$STATUS" = "200" ]; then
  echo -e "${YELLOW}⚠️${NC} Worker endpoint returned 200 - this might mean auth is disabled!"
else
  echo -e "${RED}❌${NC} Worker endpoint returned status: $STATUS"
fi
echo ""

# Test 2: Check with worker secret
echo "Test 2: Testing with worker secret..."
WORKER_SECRET="${WORKER_SECRET:-}"
if [ -z "$WORKER_SECRET" ]; then
  echo -e "${YELLOW}⚠️  WORKER_SECRET not set, skipping authenticated test${NC}"
  echo "   Set WORKER_SECRET env var to test authenticated access"
else
  RESPONSE=$(curl -s -H "x-worker-secret: $WORKER_SECRET" "$VERCEL_URL/api/worker")
  echo "Response: $RESPONSE"

  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} Worker processed successfully!"

    # Parse the response
    PROCESSED=$(echo "$RESPONSE" | grep -o '"processed":[0-9]*' | cut -d':' -f2)
    if [ "$PROCESSED" = "0" ]; then
      echo -e "${YELLOW}ℹ️${NC}  No pending steps to process (this is normal if queue is empty)"
    else
      echo -e "${GREEN}✓${NC} Processed $PROCESSED steps"
    fi
  else
    echo -e "${RED}❌${NC} Worker failed or returned error"
  fi
fi
echo ""

# Test 3: Check database for pending steps
echo "Test 3: Checking for pending steps in database..."
if command -v psql &> /dev/null && [ ! -z "$DATABASE_URL" ]; then
  PENDING=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM nofx.step WHERE status IN ('pending', 'queued');" 2>/dev/null || echo "0")
  PENDING=$(echo $PENDING | tr -d ' ')

  if [ "$PENDING" = "0" ]; then
    echo -e "${YELLOW}ℹ️${NC}  No pending steps in database (queue is empty)"
  else
    echo -e "${GREEN}✓${NC} Found $PENDING pending steps"
  fi
else
  echo -e "${YELLOW}⚠️${NC}  psql not available or DATABASE_URL not set, skipping DB check"
fi
echo ""

# Test 4: Check Vercel cron configuration
echo "Test 4: Checking Vercel cron configuration..."
if [ -f "vercel.json" ]; then
  CRON_SCHEDULE=$(cat vercel.json | grep -A1 "crons" | grep "schedule" | cut -d'"' -f4)
  if [ ! -z "$CRON_SCHEDULE" ]; then
    echo -e "${GREEN}✓${NC} Cron schedule configured: $CRON_SCHEDULE"

    if [ "$CRON_SCHEDULE" = "* * * * *" ]; then
      echo -e "  ${GREEN}✓${NC} Runs every minute"
    fi
  else
    echo -e "${RED}❌${NC} No cron schedule found in vercel.json"
  fi
else
  echo -e "${RED}❌${NC} vercel.json not found"
fi
echo ""

# Summary
echo "=========================="
echo "Summary:"
echo "- Check Vercel dashboard > your-project > Settings > Crons to verify cron is enabled"
echo "- Check Vercel logs: vercel logs --follow"
echo "- Manual trigger: curl -H 'x-worker-secret: YOUR_SECRET' $VERCEL_URL/api/worker"
echo ""
echo "Common Issues:"
echo "1. Cron not enabled in Vercel dashboard (must enable after first deploy)"
echo "2. WORKER_SECRET not set in Vercel environment variables"
echo "3. No pending steps in database to process"
echo "4. Database connection issues from Vercel"
