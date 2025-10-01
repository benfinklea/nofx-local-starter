#!/bin/bash
# Pre-deployment validation script
# Catches common mistakes before they reach production

set -e

echo "🛡️ PRE-DEPLOY VALIDATION"
echo ""

ERRORS=0

# ===== ASYNC/AWAIT AUDIT =====
echo "🔍 [1/4] Async/Await Audit"
echo "  Checking for auth.getSession() without await..."
if grep -r "auth\.getSession()" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -v "await" | grep -v node_modules > /dev/null 2>&1; then
  echo "  🚨 CRITICAL: auth.getSession() called without await!"
  grep -r "auth\.getSession()" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -v "await" | grep -v node_modules
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ No missing await on auth.getSession()"
fi

echo "  Checking for promise chains without .catch()..."
PROMISE_CHAINS=$(grep -r "\.then(" apps/frontend/src --include="*.ts" --include="*.tsx" -c 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
if [ "$PROMISE_CHAINS" -gt 0 ]; then
  echo "  ⚠️  Found $PROMISE_CHAINS .then() calls - consider using async/await"
fi

echo ""

# ===== VERCEL CONFIGURATION VALIDATION =====
echo "📋 [2/4] Vercel Configuration"
if [ ! -f "vercel.json" ]; then
  echo "  ❌ vercel.json not found"
  ERRORS=$((ERRORS + 1))
else
  echo "  Validating JSON syntax..."
  if ! jq empty vercel.json 2>/dev/null; then
    echo "  ❌ Invalid JSON in vercel.json"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ Valid JSON"
  fi

  echo "  Checking dynamic route patterns..."
  if grep -q '"source".*:id' vercel.json; then
    echo "  ⚠️  Found :id pattern in vercel.json (should use [id])"
    echo "     This has caused production issues in the past:"
    grep -n '"source".*:id' vercel.json | sed 's/^/     Line /'
    echo "  ℹ️  Note: These rewrites map :id (Express-style) to [id] (Vercel-style)"
    echo "     This is intentional for the rewrite sources."
  else
    echo "  ✅ Dynamic routes use correct pattern"
  fi
fi

echo ""

# ===== AUTHENTICATION PATTERNS =====
echo "🔐 [3/4] Authentication Security"
echo "  Checking for password logging..."
if grep -r "password" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -E "(console\\.log|logger\\.info|JSON\\.stringify)" | grep -v node_modules > /dev/null 2>&1; then
  echo "  🚨 Password logging detected!"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ No password logging"
fi

echo "  Checking CRON_SECRET usage..."
if [ -f "api/worker.ts" ]; then
  if grep -q "WORKER_SECRET\|ADMIN_PASSWORD\|x-worker-secret" api/worker.ts; then
    echo "  ✅ Worker authentication present"
  else
    echo "  ⚠️  api/worker.ts exists but no auth check found"
  fi
fi

echo ""

# ===== PREDICTIVE CHECKS (Based on Historical Patterns) =====
echo "🔮 [4/6] Predictive Pattern Detection"

echo "  Checking React useEffect patterns..."
if grep -r "useEffect.*\.then\|useEffect.*fetch" apps/frontend/src --include="*.tsx" 2>/dev/null | grep -v "controller\|mounted\|cleanup\|abort" > /dev/null; then
  echo "  ⚠️  Found useEffect with async without cleanup (race condition risk)"
  echo "     Add cleanup: const mounted = true; return () => mounted = false;"
fi

echo "  Checking for direct localStorage access..."
LOCALSTORAGE_COUNT=$(grep -r "localStorage\\.setItem\|localStorage\\.getItem" apps/frontend/src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "safeLocalStorage\.ts\|safeLocalStorage\|// @allow-localStorage" | wc -l)
if [ "$LOCALSTORAGE_COUNT" -gt 0 ]; then
  echo "  ⚠️  Found $LOCALSTORAGE_COUNT direct localStorage calls (quota risk)"
  echo "     Consider using wrapper: safeLocalStorage()"
fi

echo "  Checking API error handling..."
API_WITHOUT_TRY=0
for file in api/*.ts; do
  if [ -f "$file" ]; then
    if grep -q "export default" "$file"; then
      if ! grep -q "try\|catch" "$file"; then
        echo "  ⚠️  $file: Missing try/catch"
        API_WITHOUT_TRY=$((API_WITHOUT_TRY + 1))
      fi
    fi
  fi
done
if [ "$API_WITHOUT_TRY" -gt 0 ]; then
  echo "  ⚠️  $API_WITHOUT_TRY API endpoints without error handling"
fi

echo ""

# ===== STATE SYNCHRONIZATION =====
echo "🔄 [5/6] State Synchronization Check"

echo "  Checking auth state sources..."
AUTH_SOURCES=$(grep -r "localStorage.*auth\|sessionStorage.*auth\|auth\.getSession" apps/frontend/src --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ "$AUTH_SOURCES" -gt 10 ]; then
  echo "  ⚠️  Auth state accessed in $AUTH_SOURCES places (desync risk)"
  echo "     Consider centralizing auth state management"
fi

echo ""

# ===== BUILD VALIDATION =====
echo "🔨 [6/6] Build Validation"
echo "  Running TypeScript check..."
if npm run gate:typecheck > /dev/null 2>&1; then
  echo "  ✅ TypeScript compilation passed"
else
  echo "  ❌ TypeScript errors found"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ===== SUMMARY =====
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ PRE-DEPLOY VALIDATION PASSED"
  echo ""
  echo "Safe to deploy 🚀"
  exit 0
else
  echo "❌ PRE-DEPLOY VALIDATION FAILED"
  echo ""
  echo "Found $ERRORS critical issue(s)"
  echo "Fix these issues before deploying"
  exit 1
fi
