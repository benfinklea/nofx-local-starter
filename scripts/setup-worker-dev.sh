#!/bin/bash
set -e

# NOFX Worker Development Setup Script
# This script sets up the local development environment for the Redis worker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 NOFX Worker Development Setup"
echo "================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt yes/no
prompt_yes_no() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js v20 or later"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js version is less than 20${NC}"
    echo "Please upgrade to Node.js v20 or later"
fi

echo -e "${GREEN}✅ Prerequisites check complete${NC}"
echo ""

# Setup environment files
echo "🔧 Setting up environment files..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        echo -e "${GREEN}✅ Created .env from .env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env.example found, creating basic .env${NC}"
        cat > "$PROJECT_ROOT/.env" << EOF
# Local Development Environment
NODE_ENV=development

# Database (Supabase local)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Queue Configuration
QUEUE_DRIVER=redis
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=2
STEP_TIMEOUT_MS=30000

# Supabase Local
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Worker Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PORT=3001

# Logging
LOG_LEVEL=debug
EOF
    fi
else
    echo -e "${YELLOW}⚠️  .env already exists, skipping${NC}"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
cd "$PROJECT_ROOT"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Start Redis container
echo ""
echo "🔴 Setting up Redis..."

if docker ps -a | grep -q nofx-redis; then
    echo "Redis container already exists"
    if ! docker ps | grep -q nofx-redis; then
        echo "Starting Redis container..."
        docker start nofx-redis
    fi
else
    echo "Creating Redis container..."
    docker run -d \
        --name nofx-redis \
        -p 6379:6379 \
        --restart unless-stopped \
        redis:7-alpine \
        redis-server --appendonly yes
fi

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
for i in {1..10}; do
    if docker exec nofx-redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Redis failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Setup Supabase if requested
echo ""
if prompt_yes_no "Do you want to set up Supabase locally?"; then
    if command_exists supabase; then
        echo "Starting Supabase..."
        cd "$PROJECT_ROOT"
        if [ -d "supabase" ]; then
            supabase start
        else
            echo -e "${YELLOW}⚠️  No supabase directory found, initializing...${NC}"
            supabase init
            supabase start
        fi

        # Update .env with Supabase credentials
        echo ""
        echo "📝 Update your .env with the Supabase credentials shown above"
    else
        echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
        echo "Install with: brew install supabase/tap/supabase"
    fi
else
    echo "Skipping Supabase setup"
fi

# Create test script
echo ""
echo "📝 Creating helper scripts..."

cat > "$PROJECT_ROOT/start-worker-dev.sh" << 'EOF'
#!/bin/bash
# Start the worker in development mode

echo "🚀 Starting NOFX Worker in development mode..."

# Check if Redis is running
if ! docker ps | grep -q nofx-redis; then
    echo "Starting Redis..."
    docker start nofx-redis
    sleep 2
fi

# Start worker with auto-restart
npm run dev:worker
EOF

chmod +x "$PROJECT_ROOT/start-worker-dev.sh"

cat > "$PROJECT_ROOT/test-worker.sh" << 'EOF'
#!/bin/bash
# Test worker functionality

echo "🧪 Testing Worker Setup..."

# Test Redis connection
echo -n "Testing Redis connection... "
if docker exec nofx-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
    exit 1
fi

# Test worker health endpoint (if running)
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "Worker health check: ✅"
    curl -s http://localhost:3001/health | jq .
else
    echo "Worker health check: Not running"
fi

# Create a test job
echo ""
echo "Creating test job..."
curl -X POST http://localhost:3000/api/runs \
    -H "Content-Type: application/json" \
    -d '{"plan": {"goal": "test", "steps": [{"name": "echo", "tool": "test:echo", "inputs": {"message": "Hello from worker!"}}]}}'
EOF

chmod +x "$PROJECT_ROOT/test-worker.sh"

# Show summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "================================"
echo ""
echo "📚 Quick Start Commands:"
echo ""
echo "  1. Start the worker:"
echo "     ./start-worker-dev.sh"
echo ""
echo "  2. In another terminal, start the API:"
echo "     npm run dev"
echo ""
echo "  3. Test the worker:"
echo "     ./test-worker.sh"
echo ""
echo "  4. View Redis data:"
echo "     docker exec -it nofx-redis redis-cli"
echo ""
echo "  5. View worker logs:"
echo "     docker logs -f nofx-redis"
echo ""
echo "  6. Stop Redis:"
echo "     docker stop nofx-redis"
echo ""
echo "📖 Documentation:"
echo "  - Worker deployment: WORKER_DEPLOYMENT.md"
echo "  - AI coder guide: AI_CODER_GUIDE.md"
echo ""
echo "🔍 Monitoring URLs (when running):"
echo "  - Health: http://localhost:3001/health"
echo "  - Metrics: http://localhost:3001/metrics"
echo ""

# Check for common issues
echo "⚠️  Common Issues:"
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}  - .env file not configured${NC}"
fi

if ! grep -q "REDIS_URL=redis://localhost:6379" "$PROJECT_ROOT/.env" 2>/dev/null; then
    echo -e "${YELLOW}  - REDIS_URL not set to local Redis${NC}"
fi

if ! grep -q "QUEUE_DRIVER=redis" "$PROJECT_ROOT/.env" 2>/dev/null; then
    echo -e "${YELLOW}  - QUEUE_DRIVER not set to 'redis'${NC}"
fi

echo ""
echo "Happy coding! 🎉"