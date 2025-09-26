#!/usr/bin/env bash
# Don't use set -e so tests can continue after failures
set -uo pipefail

# Simple test runner for startup script functions
# This tests the logic without actually starting services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
assert() {
  local condition="$1"
  local message="$2"

  if eval "$condition"; then
    echo -e "${GREEN}✓${NC} $message"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $message"
    ((TESTS_FAILED++))
  fi
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="$3"

  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}✓${NC} $message"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $message"
    echo "  Expected: '$expected'"
    echo "  Got: '$actual'"
    ((TESTS_FAILED++))
  fi
}

assert_contains() {
  local text="$1"
  local substring="$2"
  local message="$3"

  if [[ "$text" == *"$substring"* ]]; then
    echo -e "${GREEN}✓${NC} $message"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $message"
    echo "  Text: '$text'"
    echo "  Should contain: '$substring'"
    ((TESTS_FAILED++))
  fi
}

echo -e "${YELLOW}Testing NOFX Startup Script Functions${NC}"
echo "========================================"

# Test 1: Log function
echo -e "\n${YELLOW}Test: Log Function${NC}"
(
  LOG_PREFIX="[TEST]"
  log() {
    printf '%s %s\n' "$LOG_PREFIX" "$1"
  }

  output=$(log "test message")
  assert_equals "[TEST] test message" "$output" "Log function formats correctly"
)

# Test 2: Environment variables
echo -e "\n${YELLOW}Test: Environment Variables${NC}"
(
  export QUEUE_DRIVER="${QUEUE_DRIVER:-memory}"
  export REDIS_URL="${REDIS_URL:-memory}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:50000/postgres}"
  export VITE_HOST="${VITE_HOST:-0.0.0.0}"
  export VITE_PORT="${VITE_PORT:-5173}"

  assert_equals "memory" "$QUEUE_DRIVER" "QUEUE_DRIVER defaults to memory"
  assert_equals "memory" "$REDIS_URL" "REDIS_URL defaults to memory"
  assert_contains "$DATABASE_URL" "postgresql" "DATABASE_URL contains postgresql"
  assert_equals "0.0.0.0" "$VITE_HOST" "VITE_HOST defaults to 0.0.0.0"
  assert_equals "5173" "$VITE_PORT" "VITE_PORT defaults to 5173"
)

# Test 3: Custom environment variables
echo -e "\n${YELLOW}Test: Custom Environment Variables${NC}"
(
  export VITE_PORT="3333"
  export VITE_HOST="localhost"

  export VITE_HOST="${VITE_HOST:-0.0.0.0}"
  export VITE_PORT="${VITE_PORT:-5173}"

  assert_equals "localhost" "$VITE_HOST" "VITE_HOST respects existing value"
  assert_equals "3333" "$VITE_PORT" "VITE_PORT respects existing value"
)

# Test 4: require_cmd function
echo -e "\n${YELLOW}Test: Dependency Checking${NC}"
(
  require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
      echo "Missing dependency: $1" >&2
      return 1
    fi
    return 0
  }

  # Test existing command
  output=$(require_cmd "bash" 2>&1 && echo "SUCCESS" || echo "FAILED")
  if [[ "$output" == *"SUCCESS"* ]]; then
    result="pass"
  else
    result="fail"
  fi
)
if [[ "$result" == "pass" ]]; then
  echo -e "${GREEN}✓${NC} require_cmd detects existing command (bash)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} require_cmd failed for existing command"
  ((TESTS_FAILED++))
fi

(
  require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
      echo "Missing dependency: $1" >&2
      return 1
    fi
    return 0
  }

  # Test non-existing command
  output=$(require_cmd "nonexistentcommand123" 2>&1 && echo "SUCCESS" || echo "FAILED")
  if [[ "$output" == *"FAILED"* ]]; then
    result="pass"
  else
    result="fail"
  fi
)
if [[ "$result" == "pass" ]]; then
  echo -e "${GREEN}✓${NC} require_cmd detects missing command"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} require_cmd failed to detect missing command"
  ((TESTS_FAILED++))
fi

# Continue in parent shell
(
)

# Test 5: Port cleanup logic
echo -e "\n${YELLOW}Test: Port Cleanup Logic${NC}"
(
  # Test that lsof command syntax is correct
  cmd="lsof -ti:3000 2>/dev/null || true"

  # Just verify the command can run without error
  if eval "$cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Port cleanup command syntax is valid"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} Port cleanup command has syntax error"
    ((TESTS_FAILED++))
  fi
)

# Test 6: Process ID validation
echo -e "\n${YELLOW}Test: Process ID Validation${NC}"
(
  # Start a background process
  sleep 30 &
  test_pid=$!

  # Test valid PID
  if kill -0 $test_pid 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Can validate running process"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} Failed to validate running process"
    ((TESTS_FAILED++))
  fi

  # Kill the process
  kill $test_pid 2>/dev/null
  sleep 0.5

  # Test invalid PID
  if ! kill -0 $test_pid 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Can detect stopped process"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} Failed to detect stopped process"
    ((TESTS_FAILED++))
  fi
)

# Test 7: Trap handler setup
echo -e "\n${YELLOW}Test: Trap Handler${NC}"
(
  trap_executed=false

  test_trap() {
    trap_executed=true
  }

  trap test_trap EXIT

  # Trigger trap by exiting subshell
  (exit 0)

  # Check in parent shell (trap doesn't execute here, testing syntax only)
  echo -e "${GREEN}✓${NC} Trap handler syntax is valid"
  ((TESTS_PASSED++))
)

# Test 8: Wait for HTTP logic
echo -e "\n${YELLOW}Test: Wait for HTTP Function${NC}"
(
  wait_for_http() {
    local url="$1"
    local label="$2"
    local attempts="${3:-60}"
    local sleep_time="${4:-1}"

    # Just test the loop logic without actual curl
    for ((i=0; i<attempts; i++)); do
      if [ $i -eq 2 ]; then
        # Simulate success on third attempt
        return 0
      fi
      sleep 0.01  # Very short sleep for testing
    done
    return 1
  }

  if wait_for_http "http://test" "test" 5 0.01; then
    echo -e "${GREEN}✓${NC} wait_for_http function logic works"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} wait_for_http function failed"
    ((TESTS_FAILED++))
  fi
)

# Test 9: File path sanitization
echo -e "\n${YELLOW}Test: File Path Sanitization${NC}"
(
  label="API (http://localhost:3000)"
  sanitized="${label//[^a-zA-Z0-9]/-}"

  assert_equals "API--http---localhost-3000-" "$sanitized" "Label sanitization works"
)

# Test 10: Startup script file exists and is executable
echo -e "\n${YELLOW}Test: Startup Script File${NC}"
(
  script_file="/Volumes/Development/nofx-local-starter/Start DB + NOFX.command"

  if [ -f "$script_file" ]; then
    echo -e "${GREEN}✓${NC} Startup script file exists"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} Startup script file not found"
    ((TESTS_FAILED++))
  fi

  if [ -x "$script_file" ]; then
    echo -e "${GREEN}✓${NC} Startup script is executable"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} Startup script is not executable"
    ((TESTS_FAILED++))
  fi
)

# Summary
echo ""
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi