# NOFX Control Plane - Quick Start Guide

## 🚀 5-Minute Setup

Get NOFX Control Plane running in 5 minutes with these simple steps!

### Prerequisites Checklist
- [ ] Node.js 20+ installed (`node -v`)
- [ ] Docker Desktop running
- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Git installed

### Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/your-org/nofx-local-starter.git
cd nofx-local-starter

# Run automated bootstrap
npm run bootstrap:dev
```

### Step 2: Start Services (1 minute)

```bash
# Start all services
npm run dev

# In a new terminal, start the web interface
npm run fe:dev
```

### Step 3: Access Web Interface (30 seconds)

1. Open your browser
2. Navigate to: **http://localhost:5173**
3. Sign up or login with your credentials

### Step 4: Create Your First Run (1 minute)

1. Click **"New Run"** on the dashboard
2. Enter a goal: "Generate a project README"
3. Select the **"codegen"** agent
4. Click **"Create"** to start the run

### Step 5: Monitor Progress (30 seconds)

1. Click on your run ID to view details
2. Watch the real-time execution timeline
3. Download generated artifacts when complete

## 🎯 That's It!

You now have NOFX Control Plane running locally. Here's what you can do next:

### Quick Actions

| Action | Command/URL | Description |
|--------|------------|-------------|
| View Dashboard | http://localhost:5173 | Main web interface |
| API Health Check | `curl http://localhost:3000/health` | Verify API is running |
| View Database | http://localhost:54323 | Supabase Studio |
| View Logs | `npm run dev` terminal | Real-time logs |
| Stop Services | `Ctrl+C` in terminals | Stop all services |

### Common Commands

```bash
# Development
npm run dev              # Start API and Worker
npm run fe:dev          # Start Frontend

# Database
supabase start          # Start Supabase
supabase db reset       # Reset database
supabase status         # Check status

# Testing
npm test                # Run tests
npm run test:api        # API tests only

# Import AI Models
npm run import:models:openai     # Import OpenAI models
npm run import:models:anthropic  # Import Anthropic models
```

## 📖 Visual Interface Overview

### Dashboard Layout
```
┌──────────────────────────────────┐
│        NOFX Control Plane        │
├──────────────────────────────────┤
│  📊 Metrics    │ 🏃 Active: 3    │
│  ✅ Success: 94%│ 💰 Cost: $12   │
├──────────────────────────────────┤
│  Recent Runs                     │
│  • #1234 ✓ Complete (2m ago)     │
│  • #1233 ● Running               │
│  • #1232 ✓ Complete (5m ago)     │
├──────────────────────────────────┤
│ [New Run] [Analytics] [Settings] │
└──────────────────────────────────┘
```

### Navigation Menu
- **Dashboard** (`/`) - Overview and metrics
- **Runs** (`/runs`) - All workflow executions
- **Projects** (`/projects`) - Project management
- **Models** (`/models`) - AI model configuration
- **Settings** (`/settings`) - Application settings
- **Dev Tools** (`/dev`) - Developer utilities

## 🔧 Quick Configuration

### Environment Variables (.env)
```bash
# Essential configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
API_PORT=3000
FRONTEND_PORT=5173
```

### Add Your AI API Keys
```bash
# In .env file
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

## 🆘 Quick Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Port already in use | `lsof -i :3000` and kill the process |
| Supabase won't start | `supabase stop` then `supabase start` |
| Frontend blank | Clear browser cache, check console |
| Authentication fails | Check .env variables, reset database |
| Runs not executing | Verify worker is running: `npm run dev:worker` |

## 📚 Next Steps

1. **Read Full Documentation**: [Web Interface Guide](./WEB_INTERFACE_GUIDE.md)
2. **Explore Examples**: Check `examples/` directory
3. **Join Community**: [Discord](https://discord.gg/nofx)
4. **Watch Tutorial**: [YouTube Walkthrough](https://youtube.com/nofx)

## 🎉 Congratulations!

You're now ready to build and deploy AI agents with NOFX Control Plane!

Need help?
- 📧 Email: support@nofx.ai
- 💬 Discord: https://discord.gg/nofx
- 📖 Docs: https://docs.nofx.ai

---
*Quick Start Guide v1.0 - Get running in 5 minutes!*