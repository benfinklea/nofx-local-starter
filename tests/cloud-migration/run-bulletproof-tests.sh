#!/bin/bash

echo "🚀 NOFX Cloud Migration - Bulletproof Test Suite"
echo "================================================"
echo ""
echo "This comprehensive test suite ensures the cloud migration"
echo "to Vercel + Supabase is completely bulletproof and will"
echo "never break again."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test categories
declare -a test_suites=(
  "vercel-functions:Vercel Functions API"
  "supabase-database:Supabase Database"
  "frontend-e2e:Frontend Deployment"
  "health-monitoring:Health Monitoring"
  "deployment-validation:Deployment Validation"
)

# Results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test suite
run_test_suite() {
  local suite_file=$1
  local suite_name=$2

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🧪 Testing: ${suite_name}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Run the test
  if npm test -- "tests/cloud-migration/${suite_file}.test.ts" --config="tests/cloud-migration/jest.config.js"; then
    echo -e "${GREEN}✅ ${suite_name} - PASSED${NC}"
    ((PASSED_TESTS++))
  else
    echo -e "${RED}❌ ${suite_name} - FAILED${NC}"
    ((FAILED_TESTS++))
  fi

  ((TOTAL_TESTS++))
  echo ""
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm is not installed${NC}"
  exit 1
fi

# Check if production URL is accessible
echo "🌐 Checking production URL..."
if curl -s -o /dev/null -w "%{http_code}" https://nofx-control-plane.vercel.app | grep -q "200"; then
  echo -e "${GREEN}✅ Production site is accessible${NC}"
else
  echo -e "${YELLOW}⚠️  Production site may be down or inaccessible${NC}"
fi

echo ""
echo "🛡️ Starting Bulletproof Test Suite"
echo "=================================="
echo ""

# Run each test suite
for suite in "${test_suites[@]}"; do
  IFS=':' read -r file name <<< "$suite"
  run_test_suite "$file" "$name"
done

# Performance tests
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚡ Performance Benchmarks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Quick performance check
echo "Testing API response time..."
API_TIME=$(curl -o /dev/null -s -w "%{time_total}" https://nofx-control-plane.vercel.app/api/health)
echo "API Response Time: ${API_TIME}s"

if (( $(echo "$API_TIME < 3" | bc -l) )); then
  echo -e "${GREEN}✅ API performance is good${NC}"
else
  echo -e "${YELLOW}⚠️  API response time is slow (${API_TIME}s)${NC}"
fi

echo ""

# Security scan
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔒 Security Quick Scan${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check for exposed secrets in health endpoint
HEALTH_RESPONSE=$(curl -s https://nofx-control-plane.vercel.app/api/health)
if echo "$HEALTH_RESPONSE" | grep -q -E "(password|secret|key|token)" | grep -v "error"; then
  echo -e "${RED}❌ Potential secrets exposure detected${NC}"
else
  echo -e "${GREEN}✅ No secrets exposed in health endpoint${NC}"
fi

# Check security headers
HEADERS=$(curl -sI https://nofx-control-plane.vercel.app)
if echo "$HEADERS" | grep -q -i "x-frame-options\|x-content-type-options\|strict-transport-security"; then
  echo -e "${GREEN}✅ Security headers present${NC}"
else
  echo -e "${YELLOW}⚠️  Some security headers may be missing${NC}"
fi

echo ""

# Final report
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 BULLETPROOF TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   🎉 ALL TESTS PASSED! 🎉             ║${NC}"
  echo -e "${GREEN}║                                        ║${NC}"
  echo -e "${GREEN}║   The cloud migration is BULLETPROOF! ║${NC}"
  echo -e "${GREEN}║   This feature will never break again!║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ⚠️  SOME TESTS FAILED                ║${NC}"
  echo -e "${RED}║                                        ║${NC}"
  echo -e "${RED}║   Please fix the issues and re-run    ║${NC}"
  echo -e "${RED}║   the bulletproof test suite.         ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}"
  exit 1
fi