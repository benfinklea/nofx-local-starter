#!/bin/bash

echo "🛡️ Running Cloud Migration Bulletproof Tests"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if the cloud migration tests directory exists
if [ ! -d "tests/cloud-migration" ]; then
  echo -e "${RED}❌ Cloud migration tests directory not found${NC}"
  exit 1
fi

# Install dependencies if needed
echo "📦 Installing test dependencies..."
cd tests/cloud-migration
if [ ! -d "node_modules" ]; then
  npm install
fi
cd ../..

# Run tests with Jest
echo ""
echo "🧪 Running test suites..."
echo ""

# Run each test file
cd tests/cloud-migration

echo -e "${YELLOW}1. Testing Vercel Functions...${NC}"
npx jest vercel-functions.test.ts --passWithNoTests

echo ""
echo -e "${YELLOW}2. Testing Supabase Database...${NC}"
npx jest supabase-database.test.ts --passWithNoTests

echo ""
echo -e "${YELLOW}3. Testing Health Monitoring...${NC}"
npx jest health-monitoring.test.ts --passWithNoTests

echo ""
echo -e "${YELLOW}4. Testing Deployment Validation...${NC}"
npx jest deployment-validation.test.ts --passWithNoTests

echo ""
echo -e "${YELLOW}5. Testing Frontend E2E (requires Playwright)...${NC}"
if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
  npx playwright test frontend-e2e.test.ts
else
  echo "Playwright not installed. Skipping E2E tests."
  echo "To run E2E tests: npx playwright install"
fi

cd ../..

echo ""
echo -e "${GREEN}✅ Cloud migration tests complete!${NC}"
echo ""
echo "To run specific tests:"
echo "  cd tests/cloud-migration && npx jest <test-file>"
echo ""
echo "To run E2E tests:"
echo "  cd tests/cloud-migration && npx playwright test frontend-e2e.test.ts"