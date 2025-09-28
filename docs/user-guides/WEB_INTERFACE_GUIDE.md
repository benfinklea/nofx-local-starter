# NOFX Control Plane - Web Interface User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Initial Setup](#initial-setup)
4. [Accessing the Web Interface](#accessing-the-web-interface)
5. [User Authentication](#user-authentication)
6. [Main Dashboard](#main-dashboard)
7. [Agent Operations](#agent-operations)
8. [Project Management](#project-management)
9. [Model Configuration](#model-configuration)
10. [Analytics & Monitoring](#analytics--monitoring)
11. [Settings & Configuration](#settings--configuration)
12. [Developer Tools](#developer-tools)
13. [Troubleshooting](#troubleshooting)
14. [FAQs](#frequently-asked-questions)

---

## Introduction

The NOFX Control Plane Web Interface is a powerful, enterprise-grade platform for managing AI agents, orchestrating workflows, and monitoring system operations. This guide will walk you through setup, configuration, and daily usage of the web interface.

### Key Features
- 🤖 **AI Agent Management**: Create, configure, and deploy AI agents
- 🔄 **Workflow Orchestration**: Design and execute complex multi-agent workflows
- 📊 **Real-Time Monitoring**: Track performance, costs, and system health
- 🔐 **Enterprise Security**: Role-based access control with SSO support
- 🌐 **Multi-Project Support**: Manage multiple projects and environments
- 📈 **Analytics Dashboard**: Comprehensive insights and reporting

---

## System Requirements

### Prerequisites
- **Operating System**: macOS, Linux, or Windows (with WSL2)
- **Node.js**: Version 20.x or higher
- **Docker Desktop**: For running local services
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

### Required Services
- **Supabase**: Local or cloud instance for database and authentication
- **Redis**: For queue management and caching
- **Storage**: Local filesystem or cloud storage for artifacts

### Recommended Specifications
- **RAM**: 8GB minimum, 16GB recommended
- **CPU**: 4 cores minimum
- **Disk Space**: 10GB free space for local development

---

## Initial Setup

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-org/nofx-local-starter.git
cd nofx-local-starter
```

### Step 2: Run Bootstrap Script

The fastest way to get started is using the automated bootstrap script:

```bash
# Run automated setup
npm run bootstrap:dev
```

This script will:
1. Start Supabase local instance
2. Apply database migrations
3. Create necessary storage buckets
4. Install dependencies
5. Set up environment variables
6. Run health checks

### Step 3: Manual Setup (Alternative)

If the bootstrap script fails or you prefer manual setup:

```bash
# 1. Start Supabase
supabase start

# 2. Apply database schema
supabase db reset

# 3. Install dependencies
npm install
cd apps/frontend && npm install && cd ../..

# 4. Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 5. Create storage bucket
npm run create:bucket
```

### Step 4: Start the Services

```bash
# Start all services (API, Worker, and Frontend)
npm run dev

# In a new terminal, start the frontend
npm run fe:dev
```

---

## Accessing the Web Interface

Once all services are running, you can access the web interface:

### Local Development
- **URL**: http://localhost:5173
- **API Endpoint**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323

### Production/Staging
- **URL**: https://your-domain.com
- **API Endpoint**: https://api.your-domain.com

### First Time Access

1. Open your web browser and navigate to the URL
2. You'll be redirected to the login page
3. Use your credentials or sign up for a new account

**Screenshot: Login Page**
```
┌────────────────────────────────────────┐
│          NOFX Control Plane           │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  Email: ________________         │  │
│  │                                   │  │
│  │  Password: ________________      │  │
│  │                                   │  │
│  │  [✓] Remember me                  │  │
│  │                                   │  │
│  │  ┌────────────┐  ┌─────────────┐ │  │
│  │  │   Login    │  │  Sign Up    │ │  │
│  │  └────────────┘  └─────────────┘ │  │
│  │                                   │  │
│  │  Forgot Password? | SSO Login    │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## User Authentication

### Creating an Account

1. Click "Sign Up" on the login page
2. Enter your details:
   - Email address
   - Password (minimum 8 characters)
   - Organization name (optional)
3. Verify your email address
4. Complete profile setup

### Login Methods

#### Email/Password Login
- Enter your registered email and password
- Check "Remember me" to stay logged in
- Click "Login"

#### Single Sign-On (SSO)
- Click "SSO Login"
- Enter your organization's SSO domain
- Authenticate with your organization's identity provider

#### Password Reset
1. Click "Forgot Password?" on the login page
2. Enter your email address
3. Check your email for reset instructions
4. Follow the link to set a new password

### Session Management
- Sessions expire after 7 days of inactivity
- Active sessions are extended automatically
- Multiple device login supported

---

## Main Dashboard

After logging in, you'll see the main dashboard:

**Screenshot: Dashboard Overview**
```
┌─────────────────────────────────────────────────────┐
│  NOFX Control Plane          [Projects ▼] [User ▼]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Welcome back, User!           Last login: 2 hrs ago│
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Active Runs │ │ Total Runs  │ │Success Rate │  │
│  │     12      │ │    1,247    │ │    94.3%    │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                     │
│  Recent Activity                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ • Run #1234 completed successfully - 2m ago  │  │
│  │ • New agent "DataProcessor" deployed - 15m   │  │
│  │ • Workflow "ETL Pipeline" started - 1h ago   │  │
│  │ • Model updated: GPT-4 → GPT-4-Turbo - 3h   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Quick Actions                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐      │
│  │ New Run  │ │New Agent │ │View Analytics│      │
│  └──────────┘ └──────────┘ └──────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Dashboard Components

#### Key Metrics
- **Active Runs**: Currently executing workflows
- **Total Runs**: Historical count of all runs
- **Success Rate**: Percentage of successful completions
- **System Health**: Overall system status indicator

#### Recent Activity Feed
- Real-time updates of system events
- Filter by type: Runs, Agents, Errors, etc.
- Click any item for detailed view

#### Quick Actions
- **New Run**: Start a new workflow execution
- **New Agent**: Create and deploy a new agent
- **View Analytics**: Access detailed analytics dashboard

---

## Agent Operations

### Creating a New Run

1. Click "New Run" from the dashboard or navigate to Runs → New Run

**Screenshot: New Run Form**
```
┌─────────────────────────────────────────────────────┐
│  Create New Run                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Run Configuration                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Name: [Marketing Campaign Analysis        ]  │  │
│  │                                              │  │
│  │ Goal: [Analyze Q4 marketing performance    ]  │  │
│  │                                              │  │
│  │ Agent Selection:                             │  │
│  │ ┌──────────────────────────────────────┐    │  │
│  │ │ [✓] DataAnalyzer                      │    │  │
│  │ │ [✓] ReportGenerator                   │    │  │
│  │ │ [ ] CodeReviewer                      │    │  │
│  │ └──────────────────────────────────────┘    │  │
│  │                                              │  │
│  │ Steps:                              [+ Add]  │  │
│  │ 1. Extract data from sources                │  │
│  │ 2. Analyze performance metrics               │  │
│  │ 3. Generate comprehensive report             │  │
│  │                                              │  │
│  │ Advanced Options ▼                           │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────┐  ┌────────┐                         │
│  │ Create   │  │ Cancel │                         │
│  └──────────┘  └────────┘                         │
└─────────────────────────────────────────────────────┘
```

### Monitoring Run Progress

Navigate to Runs to see all runs:

**Screenshot: Runs List**
```
┌─────────────────────────────────────────────────────┐
│  Runs                          [Filter] [New Run]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ ID      Name                Status   Duration│  │
│  ├─────────────────────────────────────────────┤  │
│  │ #1234   Marketing Analysis   ● Running  12m  │  │
│  │ #1233   Data Pipeline       ✓ Success  8m   │  │
│  │ #1232   Code Review         ✓ Success  15m  │  │
│  │ #1231   Report Generation   ✗ Failed   3m   │  │
│  │ #1230   System Backup       ✓ Success  22m  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [← Previous] Page 1 of 25 [Next →]                │
└─────────────────────────────────────────────────────┘
```

### Run Detail View

Click on any run to view detailed information:

**Screenshot: Run Detail**
```
┌─────────────────────────────────────────────────────┐
│  Run #1234 - Marketing Analysis                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Status: ● Running     Started: 12 minutes ago     │
│  Progress: ████████░░░░░░░░ 60%                    │
│                                                     │
│  Timeline                                           │
│  ┌─────────────────────────────────────────────┐  │
│  │ 10:15 AM  Started run                       │  │
│  │ 10:15 AM  ✓ Step 1: Data extraction complete│  │
│  │ 10:18 AM  ✓ Step 2: Analysis in progress    │  │
│  │ 10:27 AM  ● Step 3: Generating report...    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Step Output                                        │
│  ┌─────────────────────────────────────────────┐  │
│  │ Analyzing marketing data...                  │  │
│  │ Found 1,247 campaigns                        │  │
│  │ Processing conversion rates...               │  │
│  │ Calculating ROI metrics...                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Artifacts                                          │
│  ┌─────────────────────────────────────────────┐  │
│  │ 📄 campaign_analysis.csv     [Download]     │  │
│  │ 📊 performance_chart.png     [View]         │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Project Management

### Viewing Projects

Navigate to Projects to manage your projects:

**Screenshot: Projects List**
```
┌─────────────────────────────────────────────────────┐
│  Projects                      [+ New Project]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Active Projects                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ ┌─────────────┐ ┌─────────────┐             │  │
│  │ │ Production  │ │ Staging     │             │  │
│  │ │ 45 runs     │ │ 123 runs    │             │  │
│  │ │ ● Active    │ │ ● Active    │             │  │
│  │ └─────────────┘ └─────────────┘             │  │
│  │                                              │  │
│  │ ┌─────────────┐ ┌─────────────┐             │  │
│  │ │ Development │ │ Testing     │             │  │
│  │ │ 567 runs    │ │ 89 runs     │             │  │
│  │ │ ● Active    │ │ ○ Paused    │             │  │
│  │ └─────────────┘ └─────────────┘             │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Project Settings                                   │
│  • Default Model: GPT-4-Turbo                      │
│  • Rate Limit: 100 requests/min                    │
│  • Auto-retry: Enabled                             │
└─────────────────────────────────────────────────────┘
```

### Creating a New Project

1. Click "+ New Project"
2. Enter project details:
   - Project name
   - Description
   - Environment type (Production/Staging/Development)
   - Git repository URL (optional)
3. Configure settings:
   - Default AI model
   - Rate limits
   - Webhook endpoints
4. Click "Create Project"

---

## Model Configuration

### Managing AI Models

Navigate to Models to configure AI model settings:

**Screenshot: Models Configuration**
```
┌─────────────────────────────────────────────────────┐
│  Model Configuration                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Available Models                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Provider   Model           Status    Priority│  │
│  ├─────────────────────────────────────────────┤  │
│  │ OpenAI     GPT-4-Turbo     ● Active    1    │  │
│  │ OpenAI     GPT-3.5-Turbo   ● Active    2    │  │
│  │ Anthropic  Claude-3-Opus   ● Active    3    │  │
│  │ Google     Gemini-Pro      ○ Inactive  4    │  │
│  │ Local      Llama-2-70B     ● Active    5    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Model Settings                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Default Model: GPT-4-Turbo                  │  │
│  │ Fallback Model: GPT-3.5-Turbo              │  │
│  │ Max Tokens: 4096                           │  │
│  │ Temperature: 0.7                           │  │
│  │ Retry on Error: ✓                          │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [Save Changes] [Import Models] [Test Connection]   │
└─────────────────────────────────────────────────────┘
```

### Importing Model Configurations

To import model configurations from providers:

```bash
# Import OpenAI models
npm run import:models:openai

# Import Anthropic models
npm run import:models:anthropic

# Import Google Gemini models
npm run import:models:gemini
```

---

## Analytics & Monitoring

### System Health Dashboard

Navigate to the System Health panel for real-time monitoring:

**Screenshot: System Health**
```
┌─────────────────────────────────────────────────────┐
│  System Health                    Last Update: Now  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Service Status                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ API Server        ● Healthy   12ms latency   │  │
│  │ Worker Queue      ● Healthy   3 jobs pending │  │
│  │ Database          ● Healthy   <1ms latency   │  │
│  │ Redis Cache       ● Healthy   0.5ms latency  │  │
│  │ Storage           ● Healthy   95% available  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Performance Metrics (Last 24 Hours)                │
│  ┌─────────────────────────────────────────────┐  │
│  │     Requests/min                             │  │
│  │ 100 ┤    ╭─╮                               │  │
│  │  75 ┤   ╱  ╰─╮  ╭─╮                        │  │
│  │  50 ┤  ╱     ╰──╯  ╰─╮                     │  │
│  │  25 ┤ ╱              ╰─────                │  │
│  │   0 └────────────────────────              │  │
│  │     00:00  06:00  12:00  18:00  24:00       │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Resource Usage                                     │
│  • CPU: 45% (4 cores)                              │
│  • Memory: 2.3 GB / 8 GB                          │
│  • Disk I/O: 125 MB/s                             │
└─────────────────────────────────────────────────────┘
```

### Analytics Dashboard

View detailed analytics and insights:

**Screenshot: Analytics**
```
┌─────────────────────────────────────────────────────┐
│  Analytics                    [Date Range ▼] [Export]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  Run Statistics (Last 30 Days)                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Total Runs: 1,247    Success Rate: 94.3%    │  │
│  │ Avg Duration: 8.2m   Total Cost: $127.43    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Agent Performance                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Agent Name        Runs  Success  Avg Time   │  │
│  ├─────────────────────────────────────────────┤  │
│  │ DataAnalyzer      423    96%     5.2m       │  │
│  │ ReportGenerator   312    92%     12.3m      │  │
│  │ CodeReviewer      289    95%     8.7m       │  │
│  │ TestRunner        223    89%     15.4m      │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Cost Breakdown                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🟦 GPT-4: $89.23 (70%)                      │  │
│  │ 🟩 GPT-3.5: $25.41 (20%)                    │  │
│  │ 🟨 Claude: $12.79 (10%)                     │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Settings & Configuration

### Application Settings

Navigate to Settings to configure application preferences:

**Screenshot: Settings Page**
```
┌─────────────────────────────────────────────────────┐
│  Settings                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  General Settings                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Organization Name: [ACME Corp            ]  │  │
│  │ Default Timezone: [UTC                   ▼] │  │
│  │ Language: [English                       ▼] │  │
│  │ Theme: ( ) Light  (●) Dark  ( ) Auto        │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  API Configuration                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │ API Key: ****************************3a2b   │  │
│  │ [Regenerate] [Copy]                         │  │
│  │                                              │  │
│  │ Webhook URL: [https://api.example.com/hook] │  │
│  │ Retry Attempts: [3                       ]  │  │
│  │ Timeout (seconds): [30                   ]  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Notification Preferences                           │
│  ┌─────────────────────────────────────────────┐  │
│  │ [✓] Email notifications for failed runs     │  │
│  │ [✓] Slack notifications for completions     │  │
│  │ [ ] SMS alerts for critical errors          │  │
│  │ [✓] Browser notifications when available    │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [Save Changes] [Reset to Defaults]                 │
└─────────────────────────────────────────────────────┘
```

### User Profile Management

Manage your user profile and security settings:

1. Click on your user avatar in the top-right corner
2. Select "Profile Settings"
3. Update your information:
   - Display name
   - Email address
   - Password
   - Two-factor authentication
   - API tokens

---

## Developer Tools

### Accessing Developer Tools

Navigate to Dev → Tools for advanced features:

**Screenshot: Developer Tools**
```
┌─────────────────────────────────────────────────────┐
│  Developer Tools                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  API Explorer                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ Endpoint: [GET /api/runs              ▼]    │  │
│  │ Headers:                                     │  │
│  │ Authorization: Bearer [token...]             │  │
│  │                                              │  │
│  │ [Send Request]                               │  │
│  │                                              │  │
│  │ Response:                                    │  │
│  │ ┌───────────────────────────────────────┐   │  │
│  │ │ {                                      │   │  │
│  │ │   "runs": [                           │   │  │
│  │ │     { "id": "1234", "status": "ok" }  │   │  │
│  │ │   ],                                   │   │  │
│  │ │   "total": 1247                       │   │  │
│  │ │ }                                      │   │  │
│  │ └───────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  Request Logger                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Time     Method  Path           Status      │  │
│  │ 10:45 AM GET     /api/runs      200         │  │
│  │ 10:44 AM POST    /api/runs/new  201         │  │
│  │ 10:43 AM GET     /api/health    200         │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Builder Interface

The Builder provides a visual workflow designer:

1. Navigate to Builder
2. Drag and drop agents to create workflows
3. Connect agents with data flow arrows
4. Configure each step's parameters
5. Test and deploy your workflow

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Cannot access the web interface

**Solution:**
1. Verify all services are running:
   ```bash
   # Check API
   curl http://localhost:3000/health

   # Check Frontend
   curl http://localhost:5173
   ```
2. Check logs for errors:
   ```bash
   # View API logs
   npm run dev:api

   # View frontend logs
   npm run fe:dev
   ```
3. Ensure ports are not in use:
   ```bash
   lsof -i :3000
   lsof -i :5173
   ```

#### Issue: Authentication fails

**Solution:**
1. Verify Supabase is running:
   ```bash
   supabase status
   ```
2. Check environment variables in `.env`
3. Reset the database if needed:
   ```bash
   supabase db reset
   ```

#### Issue: Runs fail to execute

**Solution:**
1. Check worker service is running:
   ```bash
   npm run dev:worker
   ```
2. Verify Redis connection:
   ```bash
   docker ps | grep redis
   ```
3. Check queue for stuck jobs in Redis

#### Issue: Missing data or blank pages

**Solution:**
1. Clear browser cache and cookies
2. Check browser console for JavaScript errors
3. Verify API responses in Network tab
4. Try incognito/private browsing mode

#### Issue: Slow performance

**Solution:**
1. Check system resources (CPU, Memory)
2. Optimize database queries
3. Review Redis memory usage
4. Consider scaling worker instances

### Log Locations

- **API Logs**: Console output or `logs/api.log`
- **Worker Logs**: Console output or `logs/worker.log`
- **Frontend Logs**: Browser console
- **Supabase Logs**: `supabase/logs/`

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/your-org/nofx-local-starter/issues)
2. Join our [Discord Community](https://discord.gg/nofx)
3. Contact support at support@nofx.ai

---

## Frequently Asked Questions

### General Questions

**Q: What browsers are supported?**
A: We support the latest versions of Chrome, Firefox, Safari, and Edge. For the best experience, we recommend Chrome or Firefox.

**Q: Can I use NOFX Control Plane on mobile devices?**
A: While the interface is responsive, it's optimized for desktop use. Mobile support is on our roadmap.

**Q: How do I export my data?**
A: You can export data from the Analytics page using the Export button. Supported formats include CSV, JSON, and PDF.

**Q: Is there an API for automation?**
A: Yes! Full API documentation is available at `/api/docs` when running locally, or check our API documentation.

### Security & Privacy

**Q: Is my data encrypted?**
A: Yes, all data is encrypted at rest and in transit. We use industry-standard encryption protocols.

**Q: Can I self-host NOFX Control Plane?**
A: Yes, the local starter is designed for self-hosting. For enterprise self-hosting support, contact our sales team.

**Q: How are API keys managed?**
A: API keys are hashed and stored securely. You can regenerate keys at any time from the Settings page.

**Q: What about GDPR compliance?**
A: NOFX Control Plane is GDPR compliant. You can export or delete your data at any time.

### Technical Questions

**Q: What are the system requirements for production?**
A: For production, we recommend:
- 16GB RAM minimum
- 8+ CPU cores
- 100GB SSD storage
- PostgreSQL 14+
- Redis 6+

**Q: Can I integrate with my CI/CD pipeline?**
A: Yes, use our API or CLI tools to integrate with any CI/CD system. We have plugins for Jenkins, GitHub Actions, and GitLab CI.

**Q: How do I backup my data?**
A: Use the backup commands:
```bash
# Backup database
supabase db dump > backup.sql

# Backup artifacts
tar -czf artifacts.tar.gz storage/artifacts/
```

**Q: Can I customize the interface?**
A: Yes, the frontend is built with React and Material-UI. You can modify the source code in `apps/frontend/src/`.

### Billing & Licensing

**Q: Is NOFX Control Plane free?**
A: The local starter is open source and free to use. Cloud hosting and enterprise features require a subscription.

**Q: What's included in the enterprise version?**
A: Enterprise features include:
- Priority support
- Advanced analytics
- Custom integrations
- SLA guarantees
- Dedicated infrastructure
- Training and onboarding

**Q: Can I get a trial of enterprise features?**
A: Yes, contact sales@nofx.ai for a 30-day enterprise trial.

---

## Keyboard Shortcuts

Improve your productivity with these keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick search |
| `Cmd/Ctrl + N` | New run |
| `Cmd/Ctrl + Shift + N` | New agent |
| `Cmd/Ctrl + /` | Toggle help |
| `R` | Refresh current view |
| `G then D` | Go to Dashboard |
| `G then R` | Go to Runs |
| `G then P` | Go to Projects |
| `G then S` | Go to Settings |
| `Esc` | Close modal/dialog |

---

## Advanced Features

### Multi-Agent Orchestration

Create complex workflows with multiple agents:

1. Use the Builder interface
2. Define agent dependencies
3. Set up data pipelines between agents
4. Configure parallel execution
5. Monitor multi-agent runs in real-time

### Custom Agent Development

Create your own agents:

1. Navigate to Dev → Agent Registry
2. Use the agent template
3. Define capabilities and parameters
4. Test in sandbox environment
5. Deploy to production

### Webhook Integration

Set up webhooks for external integrations:

1. Go to Settings → Webhooks
2. Add webhook endpoint
3. Configure events to trigger
4. Set authentication method
5. Test webhook delivery

### Scheduled Runs

Schedule recurring workflows:

1. Create a new run
2. Click "Schedule" instead of "Run Now"
3. Set frequency (hourly, daily, weekly, etc.)
4. Configure time zone and start time
5. Save scheduled run

---

## Best Practices

### Performance Optimization

1. **Use appropriate models**: Choose the right AI model for each task
2. **Batch operations**: Group similar operations together
3. **Cache results**: Enable caching for repeated queries
4. **Monitor resources**: Keep an eye on system resources
5. **Optimize prompts**: Write clear, concise prompts for better results

### Security Best Practices

1. **Rotate API keys regularly**: Change keys every 90 days
2. **Use environment-specific credentials**: Separate dev/staging/prod
3. **Enable 2FA**: Two-factor authentication for all users
4. **Audit logs**: Review logs regularly for suspicious activity
5. **Least privilege**: Grant minimum necessary permissions

### Workflow Design

1. **Start simple**: Begin with basic workflows and iterate
2. **Test thoroughly**: Use test data before production
3. **Handle errors**: Implement proper error handling
4. **Document workflows**: Add descriptions to all components
5. **Version control**: Use git for workflow definitions

---

## Conclusion

The NOFX Control Plane Web Interface provides a powerful platform for AI orchestration and automation. This guide covers the essential features and operations, but the platform is continuously evolving with new capabilities.

For the latest updates and features:
- Check our [Release Notes](https://github.com/your-org/nofx-local-starter/releases)
- Follow our [Blog](https://nofx.ai/blog)
- Join our [Community Forum](https://community.nofx.ai)

Remember to keep your installation updated and report any issues or feature requests through the appropriate channels.

Happy automating with NOFX Control Plane! 🚀

---

*Last updated: November 2024*
*Version: 1.0.0*
*Documentation for NOFX Control Plane Web Interface*