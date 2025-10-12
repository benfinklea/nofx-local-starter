# NOFX Architecture: How It Works for Users

**Last Updated:** 2025-10-01

## 🎯 The Big Picture

NOFX is a platform that helps entrepreneurs build software by talking in plain English. You describe what you want, and NOFX's AI agents build it for you.

---

## 🚀 New User Journey

### 1. **Sign Up & Authentication**
- Create account with email/password (Supabase Auth)
- Or sign in with GitHub OAuth (**coming soon!**)
- Your session is secured with JWT tokens

### 2. **Connect Your Repository**

**Current State (Manual):**
```
1. Go to Projects page
2. Enter project name
3. Paste local file path: /Users/you/my-project
4. Click "Add"
```

**Future State (GitHub OAuth - Coming Soon!):**
```
1. Click "Connect GitHub"
2. Authorize NOFX
3. See dropdown of your repos
4. Select repo → Select branch
5. Click "Let's Go!"
```

### 3. **Where Your Code Lives**

When you connect a repo, NOFX has three modes:

| Mode | What It Does | Where Files Live |
|------|-------------|------------------|
| **local_path** | Uses your existing local repo | Your computer: `/Users/you/my-project` |
| **clone** | NOFX clones your repo | NOFX workspace: `local_data/workspaces/{project_id}/` |
| **worktree** | NOFX creates isolated branches | NOFX worktrees: `local_data/workspaces/{project_id}/worktrees/` |

**Recommended Mode:** `worktree` - Safest, allows experimentation without breaking your main code

### 4. **Creating Runs**

A "run" is a single task you ask NOFX to complete:

```
You: "Write a haiku about fixing bugs"
NOFX: Creates a run with 1 step (codegen)
      Generates haiku → Saves to artifact
```

```
You: "Add user authentication to my app"
NOFX: Creates a run with multiple steps:
      1. Design auth system (planning)
      2. Generate auth code (codegen)
      3. Run tests (gate:test)
      4. Create pull request (git_pr)
```

### 5. **Viewing Results**

- **Runs Page:** See all your tasks
- **Run Detail:** See timeline, steps, outputs
- **Artifacts:** Click "View" to see generated content (haikus, code files, etc.)
- **Timeline:** Real-time updates as work progresses

---

## 🏗️ Where Files Are Stored

### Development (Local Machine)

```
nofx-local-starter/
├── local_data/
│   └── workspaces/
│       └── {project-id}/          ← Your cloned repo
│           ├── main/              ← Main branch
│           └── worktrees/
│               └── feature-123/   ← Isolated work area
├── runs/
│   └── {run-id}/
│       ├── run.json               ← Run metadata
│       └── steps/
│           └── {step-id}/
│               ├── haiku.md       ← Your haiku lives here!
│               ├── auth.ts        ← Generated code
│               └── outputs.json   ← Step results
└── .env                           ← Your secrets
```

### Production (Cloud)

```
Vercel (Serverless Functions)
├── Frontend (React SPA)
├── API Functions (stateless)
└── No persistent storage

Supabase
├── PostgreSQL Database
│   ├── runs table
│   ├── steps table
│   ├── events table
│   └── artifacts table
└── Storage Buckets
    └── artifacts/
        └── {run-id}/
            └── {step-id}/
                └── files...
```

**Important:** In production, files are stored in Supabase Storage, not on Vercel (which is stateless).

---

## 🌿 Git Workflow: How NOFX Uses Branches

### **Simple Mode (Default - Coming Soon!)**

What you see:
```
✅ Run completed successfully!
   [Review Changes] [Submit for Approval]
```

What NOFX does behind the scenes:
1. Creates isolated worktree: `worktrees/nofx-run-{run-id}`
2. Makes all changes there
3. Runs tests
4. If you approve → Creates PR or merges

### **Advanced Mode (For Developers)**

You can see and control:
- Which branch to work on
- Merge vs. PR strategy
- Conflict resolution
- Manual code review before merge

**Philosophy:** Most users don't care about git. Hide it by default, show it if requested.

---

## 🔐 Security: How Your Code Stays Safe

### **1. Authentication**
- Every API request requires authentication (JWT or cookie)
- No anonymous access to runs/artifacts
- Development mode has optional bypass

### **2. Isolation**
- Your repo is cloned to isolated workspace
- Changes happen in separate branches
- Nothing touches `main` without approval

### **3. Rollback**
- Every change is tracked in git
- Easy rollback: `git reset --hard origin/main`
- Run history preserved forever

### **4. Access Control**
- Only you can see your runs
- GitHub repo permissions respected
- API keys stored encrypted

---

## 💡 Key Concepts

### **Runs**
A single task or workflow. Example: "Add login page"

### **Steps**
Individual actions within a run:
- `codegen` - Generate code with AI
- `gate:test` - Run tests
- `gate:typecheck` - Type checking
- `manual:approval` - Wait for human approval
- `git_pr` - Create pull request

### **Artifacts**
Files generated by steps:
- Code files (.ts, .tsx, .py)
- Documentation (.md)
- Images, diagrams
- Test reports

### **Events**
Audit trail of everything that happens:
- `run.created`
- `step.started`
- `step.finished`
- `gate.approved`

### **Gates (Quality Checks)**
Automatic validation before code is merged:
- Tests must pass
- No TypeScript errors
- Linting rules satisfied
- Security scan clean

---

## 🎨 UI/UX Philosophy

### **Design Principles**

1. **Entrepreneur-First**
   - Use business language, not technical jargon
   - "Add inventory tracking" not "Create CRUD API"

2. **Progressive Disclosure**
   - Start simple, add complexity on request
   - Hide git/technical details by default
   - "Advanced Mode" for developers

3. **Transparency**
   - Show what's happening in real-time
   - Explain why each step matters
   - Provide rollback options

4. **Confidence Building**
   - Clear success/failure indicators
   - Easy undo/rollback
   - Preview before committing

---

## 🚧 Current Limitations & Future Improvements

### **What Works Now ✅**
- Manual project setup (local path)
- AI code generation
- Quality gates (tests, linting)
- Run tracking and history
- Artifact viewing
- Authentication

### **Coming Soon 🚀**

#### **Phase 1: Better Onboarding (Next 2 Weeks)**
- GitHub OAuth integration
- Repository dropdown selector
- Branch picker
- One-click project setup

#### **Phase 2: Smarter UX (Next Month)**
- Simple/Advanced mode toggle
- Plain English input (no technical templates)
- Real-time progress with % complete
- Artifact diffs (see what changed)

#### **Phase 3: Multi-Agent Collaboration (Next Quarter)**
- Multiple AI specialists working together
- Business analyst agent (understands your industry)
- Code reviewer agent (ensures quality)
- Testing agent (validates everything works)

---

## 📊 Example User Flows

### **Flow 1: First-Time User**

```
1. Sign up with email
2. Connect GitHub repo (OAuth)
3. Select "my-restaurant-app" repo
4. Ask: "Add table reservation feature"
5. NOFX shows plan:
   - Generate reservation form UI
   - Add database schema
   - Create API endpoints
   - Add tests
6. User clicks "Let's Build It!"
7. Watch real-time progress
8. Review generated code
9. Click "Merge to Main"
10. Feature deployed! 🎉
```

### **Flow 2: Iterating on Existing Feature**

```
1. User already has project connected
2. Navigate to "Runs" → "New Run"
3. Type: "The reservation form needs a date picker"
4. NOFX:
   - Analyzes existing code
   - Generates DatePicker component
   - Updates reservation form
   - Runs tests
5. User clicks "View Changes"
6. Sees diff of what changed
7. Click "Approve & Merge"
8. Done in 30 seconds! ⚡
```

### **Flow 3: Debugging Issue**

```
1. User: "Users report login button doesn't work"
2. NOFX:
   - Reads error logs
   - Identifies issue (typo in onClick handler)
   - Generates fix
   - Runs tests to verify
3. User reviews fix
4. Approves merge
5. Bug fixed without writing a single line of code! 🐛➡️✅
```

---

## 🔮 The Vision

**Short Term (6 months):**
Help developers build features 10x faster with AI assistance

**Medium Term (1-2 years):**
Enable non-technical entrepreneurs to build their own business software

**Long Term (5-10 years):**
Democratize software development - anyone with an idea can build it

---

## 🤝 How to Give Feedback

Your feedback shapes NOFX's future!

**What We Want to Hear:**
- What's confusing?
- What takes too long?
- What would make this 10x better?
- What's missing for your use case?

**How to Reach Us:**
- GitHub Issues: https://github.com/your-org/nofx/issues
- Discord: [coming soon]
- Email: feedback@nofx.dev

---

## 📚 Further Reading

- [AI_CODER_GUIDE.md](../AI_CODER_GUIDE.md) - For AI assistants working on NOFX
- [THE_PHILOSOPHY_OF_NOFX.md](../THE_PHILOSOPHY_OF_NOFX.md) - Our mission and values
- [API Documentation](./control-plane/openapi.yaml) - API reference

---

**Remember:** NOFX is here to amplify your creativity, not replace your judgment. You're still the boss! 🎸
