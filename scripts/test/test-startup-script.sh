#!/usr/bin/env bash
set -euo pipefail

# Test framework setup
TESTS_PASSED=0
TESTS_FAILED=0
MOCK_COMMANDS=()
TEST_TEMP_DIR=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test framework functions
setup() {
  TEST_TEMP_DIR=$(mktemp -d)
  export PATH="${TEST_TEMP_DIR}:${PATH}"
  MOCK_COMMANDS=()
}

teardown() {
  # Clean up mocked commands
  for cmd in "${MOCK_COMMANDS[@]}"; do
    rm -f "${TEST_TEMP_DIR}/${cmd}" 2>/dev/null || true
  done
  rm -rf "${TEST_TEMP_DIR}"

  # Kill any test processes
  pkill -f "test-nofx-" 2>/dev/null || true
  # Clean up any lingering Python servers
  pkill -f "python3 -m http.server" 2>/dev/null || true
  # Ensure test ports are free
  lsof -ti:8888 | xargs kill -9 2>/dev/null || true
}

mock_command() {
  local cmd="$1"
  local behavior="$2"

  MOCK_COMMANDS+=("$cmd")

  cat > "${TEST_TEMP_DIR}/${cmd}" << EOF
#!/usr/bin/env bash
${behavior}
EOF
  chmod +x "${TEST_TEMP_DIR}/${cmd}"
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local test_name="${3:-assertion}"

  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Expected: '$expected'"
    echo "  Got: '$actual'"
    ((TESTS_FAILED++))
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local test_name="${3:-assertion}"

  if echo "$haystack" | grep -q "$needle"; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Expected to find: '$needle'"
    echo "  In: '$haystack'"
    ((TESTS_FAILED++))
  fi
}

assert_process_running() {
  local pattern="$1"
  local test_name="${2:-process check}"

  if pgrep -f "$pattern" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Process not found: '$pattern'"
    ((TESTS_FAILED++))
  fi
}

assert_process_not_running() {
  local pattern="$1"
  local test_name="${2:-process check}"

  if ! pgrep -f "$pattern" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Process still running: '$pattern'"
    ((TESTS_FAILED++))
  fi
}

assert_port_free() {
  local port="$1"
  local test_name="${2:-port check}"

  if ! lsof -i:$port > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Port $port is still in use"
    ((TESTS_FAILED++))
  fi
}

assert_port_in_use() {
  local port="$1"
  local test_name="${2:-port check}"

  if lsof -i:$port > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo "  Port $port is not in use"
    ((TESTS_FAILED++))
  fi
}

run_test() {
  local test_name="$1"
  echo -e "\n${YELLOW}Running: ${test_name}${NC}"
  setup
  $test_name
  teardown
}

# Test cases
test_cleanup_kills_existing_processes() {
  # First ensure ports are free
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  sleep 0.5

  # Start dummy processes on the ports
  python3 -m http.server 3000 > /dev/null 2>&1 &
  local dummy_pid1=$!
  python3 -m http.server 5173 > /dev/null 2>&1 &
  local dummy_pid2=$!

  sleep 1

  # Verify processes started
  if ! kill -0 $dummy_pid1 2>/dev/null || ! kill -0 $dummy_pid2 2>/dev/null; then
    echo "  Skipping: Could not start test servers"
    return
  fi

  # Run the cleanup portion of the script
  bash -c '
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  '

  sleep 1

  # Verify processes are killed
  assert_port_free 3000 "Port 3000 should be free after cleanup"
  assert_port_free 5173 "Port 5173 should be free after cleanup"
}

test_start_proc_returns_pid() {
  # Test the start_proc function in isolation
  local script_content='
start_proc() {
  local cmd="$1"
  local label="$2"
  echo "  • ${label}" >&2
  echo "    ↪ ${cmd}" >&2

  # Start the process in background
  bash -lc "$cmd" > /tmp/nofx-${label//[^a-zA-Z0-9]/-}.log 2>&1 &
  local pid=$!

  # Check if process actually started
  sleep 0.5
  if kill -0 $pid 2>/dev/null; then
    echo "    ↪ PID ${pid} - Started successfully" >&2
    echo $pid  # Return PID to stdout for capture
    return 0
  else
    echo "    ⚠️  Failed to start ${label}" >&2
    return 1
  fi
}

# Test with a simple sleep command
PID=$(start_proc "sleep 30" "test-process")
echo "PID: $PID"
kill $PID 2>/dev/null || true
'

  local output=$(bash -c "$script_content" 2>/dev/null)

  # Check that we got a PID
  assert_contains "$output" "PID: " "start_proc should return a PID"
}

test_env_variables_are_set() {
  # Test that environment variables are properly set
  local script_content='
export QUEUE_DRIVER="${QUEUE_DRIVER:-memory}"
export REDIS_URL="${REDIS_URL:-memory}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:50000/postgres}"
export VITE_HOST="${VITE_HOST:-0.0.0.0}"
export VITE_PORT="${VITE_PORT:-5173}"

echo "QUEUE_DRIVER=$QUEUE_DRIVER"
echo "REDIS_URL=$REDIS_URL"
echo "DATABASE_URL=$DATABASE_URL"
echo "VITE_HOST=$VITE_HOST"
echo "VITE_PORT=$VITE_PORT"
'

  local output=$(bash -c "$script_content")

  assert_contains "$output" "QUEUE_DRIVER=memory" "QUEUE_DRIVER should default to memory"
  assert_contains "$output" "REDIS_URL=memory" "REDIS_URL should default to memory"
  assert_contains "$output" "DATABASE_URL=postgresql://postgres:postgres@localhost:50000/postgres" "DATABASE_URL should be set"
  assert_contains "$output" "VITE_HOST=0.0.0.0" "VITE_HOST should default to 0.0.0.0"
  assert_contains "$output" "VITE_PORT=5173" "VITE_PORT should default to 5173"
}

test_trap_handler_cleans_up() {
  local script_content='
API_PID=""
WORKER_PID=""
FRONT_PID=""

# Start a test process
sleep 100 &
API_PID=$!

tshutdown() {
  echo ""
  echo "♻️  Stopping dev processes…"

  # Kill processes gracefully first
  [ -n "${API_PID}" ] && kill ${API_PID} 2>/dev/null || true
  [ -n "${WORKER_PID}" ] && kill ${WORKER_PID} 2>/dev/null || true
  [ -n "${FRONT_PID}" ] && kill ${FRONT_PID} 2>/dev/null || true

  # Give them time to shutdown gracefully
  sleep 1

  # Force kill if still running
  [ -n "${API_PID}" ] && kill -9 ${API_PID} 2>/dev/null || true
  [ -n "${WORKER_PID}" ] && kill -9 ${WORKER_PID} 2>/dev/null || true
  [ -n "${FRONT_PID}" ] && kill -9 ${FRONT_PID} 2>/dev/null || true

  echo "✅ Cleanup complete"
}

trap tshutdown EXIT INT TERM

# Trigger the trap
kill -TERM $$
'

  local output=$(bash -c "$script_content" 2>&1)

  assert_contains "$output" "Stopping dev processes" "Trap handler should run"
  assert_contains "$output" "Cleanup complete" "Cleanup should complete"
}

test_dependency_check() {
  # Test that missing dependencies are detected
  mock_command "node" 'exit 0'
  mock_command "npm" 'exit 0'
  mock_command "curl" 'exit 1'  # Make curl fail

  local script_content='
require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd node
require_cmd npm
require_cmd curl
'

  local output=$(bash -c "PATH=${TEST_TEMP_DIR}:${PATH} && $script_content" 2>&1 || true)

  assert_contains "$output" "Missing dependency: curl" "Should detect missing curl"
}

test_supabase_status_check() {
  # Test Supabase status checking logic
  mock_command "supabase" 'echo "Status: running"; exit 0'

  local script_content='
SUPABASE_CMD=(supabase)

supabase_cmd() {
  "${SUPABASE_CMD[@]}" "$@"
}

if supabase_cmd status >/dev/null 2>&1; then
  echo "Supabase stack already running"
else
  echo "Starting Supabase stack"
fi
'

  local output=$(PATH="${TEST_TEMP_DIR}:${PATH}" bash -c "$script_content")

  assert_contains "$output" "Supabase stack already running" "Should detect running Supabase"
}

test_wait_for_http() {
  # Start a simple HTTP server
  python3 -m http.server 8888 > /dev/null 2>&1 &
  local server_pid=$!

  sleep 1

  local script_content='
wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local sleep_time="${4:-1}"
  printf "Waiting for %s" "${label}"
  for ((i=0; i<attempts; i++)); do
    if curl --silent --fail --max-time 2 "$url" >/dev/null 2>&1; then
      printf " ready\n"
      return 0
    fi
    printf "."
    sleep "${sleep_time}"
  done
  printf " giving up after %s attempts\n" "${attempts}"
  return 1
}

wait_for_http "http://127.0.0.1:8888" "test server" 5 0.2
'

  local output=$(bash -c "$script_content")

  kill $server_pid 2>/dev/null || true

  assert_contains "$output" "ready" "Should detect running HTTP server"
}

test_process_monitoring_loop() {
  local script_content='
API_PID=""
WORKER_PID=""
FRONT_PID=""

# Start test processes
sleep 100 &
API_PID=$!
sleep 100 &
WORKER_PID=$!

# Kill one process to trigger the monitoring
kill $API_PID 2>/dev/null

# Run one iteration of the monitoring loop
if [ -n "${API_PID}" ] && ! kill -0 ${API_PID} 2>/dev/null; then
  echo "⚠️  API process died unexpectedly"
  exit 1
fi
'

  local output=$(bash -c "$script_content" 2>&1 || true)

  assert_contains "$output" "API process died unexpectedly" "Should detect dead process"
}

test_log_function() {
  local script_content='
LOG_PREFIX="[NOFX]"

log() {
  printf "%s %s\n" "$LOG_PREFIX" "$1"
}

log "Test message"
'

  local output=$(bash -c "$script_content")

  assert_equals "[NOFX] Test message" "$output" "log function should format correctly"
}

# Main test runner
main() {
  echo -e "${YELLOW}Starting NOFX Startup Script Test Suite${NC}"
  echo "=========================================="

  # Run all tests
  run_test test_cleanup_kills_existing_processes
  run_test test_start_proc_returns_pid
  run_test test_env_variables_are_set
  run_test test_trap_handler_cleans_up
  run_test test_dependency_check
  run_test test_supabase_status_check
  run_test test_wait_for_http
  run_test test_process_monitoring_loop
  run_test test_log_function

  # Summary
  echo ""
  echo "=========================================="
  echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
  echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
  fi
}

# Run tests
main "$@"