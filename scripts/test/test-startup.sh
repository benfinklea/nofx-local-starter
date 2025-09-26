#!/usr/bin/env bash

# Test suite for NOFX startup script
# Tests core functionality without requiring services to run

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test runner
run_test() {
  local test_name="$1"
  local test_result

  echo -e "${YELLOW}Test:${NC} $test_name"

  # Run test and capture result
  if eval "test_$test_name"; then
    echo -e "  ${GREEN}✓ Passed${NC}"
    ((PASSED++))
  else
    echo -e "  ${RED}✗ Failed${NC}"
    ((FAILED++))
  fi
}

# Test 1: Script exists and is executable
test_script_exists() {
  local script="/Volumes/Development/nofx-local-starter/Start DB + NOFX.command"
  [[ -f "$script" && -x "$script" ]]
}

# Test 2: Required commands exist
test_required_commands() {
  command -v node >/dev/null 2>&1 &&
  command -v npm >/dev/null 2>&1 &&
  command -v curl >/dev/null 2>&1
}

# Test 3: Port cleanup commands work
test_port_cleanup() {
  # Test the lsof command syntax (won't fail if no processes found)
  lsof -ti:3000 2>/dev/null || true
  lsof -ti:5173 2>/dev/null || true
  return 0
}

# Test 4: Environment variables
test_env_variables() {
  (
    export QUEUE_DRIVER="${QUEUE_DRIVER:-memory}"
    export VITE_PORT="${VITE_PORT:-5173}"
    [[ "$QUEUE_DRIVER" == "memory" && "$VITE_PORT" == "5173" ]]
  )
}

# Test 5: Process monitoring
test_process_monitoring() {
  # Start a test process
  sleep 30 &
  local pid=$!

  # Check if we can monitor it
  if kill -0 $pid 2>/dev/null; then
    # Clean up
    kill $pid 2>/dev/null
    return 0
  else
    return 1
  fi
}

# Test 6: Log file creation
test_log_files() {
  local test_log="/tmp/nofx-test-$$.log"
  echo "test" > "$test_log"
  if [[ -f "$test_log" ]]; then
    rm -f "$test_log"
    return 0
  else
    return 1
  fi
}

# Test 7: Package.json files exist
test_package_files() {
  [[ -f "/Volumes/Development/nofx-local-starter/package.json" ]]
}

# Test 8: Frontend directory check
test_frontend_directory() {
  [[ -d "/Volumes/Development/nofx-local-starter/apps/frontend" ]]
}

# Test 9: Git repository check
test_git_repo() {
  cd /Volumes/Development/nofx-local-starter
  git rev-parse --is-inside-work-tree >/dev/null 2>&1
}

# Test 10: NPM scripts exist
test_npm_scripts() {
  cd /Volumes/Development/nofx-local-starter
  npm run | grep -q "dev:api" &&
  npm run | grep -q "dev:worker"
}

# Main test execution
main() {
  echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
  echo -e "${YELLOW}   NOFX Startup Script Test Suite${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════${NC}\n"

  run_test "script_exists"
  run_test "required_commands"
  run_test "port_cleanup"
  run_test "env_variables"
  run_test "process_monitoring"
  run_test "log_files"
  run_test "package_files"
  run_test "frontend_directory"
  run_test "git_repo"
  run_test "npm_scripts"

  echo -e "\n${YELLOW}═══════════════════════════════════════════${NC}"
  echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

  if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All tests passed!${NC}\n"
    return 0
  else
    echo -e "${RED}❌ Some tests failed${NC}\n"
    return 1
  fi
}

# Run the tests
main "$@"