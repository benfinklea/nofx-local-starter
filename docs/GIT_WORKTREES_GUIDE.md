# Git Worktrees Guide for NOFX Development

> **Purpose**: Enable parallel development, isolated testing, and safe experimentation without branch switching overhead.

## Table of Contents
- [🎯 Going Forward - Recommended Workflow](#-going-forward---recommended-workflow)
- [⚡ Best Practices for Merging Concurrent Worktrees](#-best-practices-for-merging-concurrent-worktrees)
- [🚀 Quick Start](#-quick-start)
- [📖 What Are Git Worktrees?](#-what-are-git-worktrees)
- [🎯 Why Use Worktrees in NOFX?](#-why-use-worktrees-in-nofx)
- [🛠️ Basic Commands](#️-basic-commands)
- [💼 NOFX-Specific Workflows](#-nofx-specific-workflows)
- [🏗️ Project Structure](#️-project-structure)
- [⚙️ Configuration](#️-configuration)
- [🚨 Common Issues & Solutions](#-common-issues--solutions)
- [✅ Best Practices](#-best-practices)
- [🧹 Cleanup & Maintenance](#-cleanup--maintenance)

## 🎯 Going Forward - Recommended Workflow

### 1. Keep main repo on main branch
Your primary repo at `/Volumes/Development/nofx-local-starter` stays on main

### 2. Create worktrees only for AI sessions:
```bash
# When starting AI work
git worktree add ../ai-feature-name feature/ai-feature-name
```

### 3. Clean up immediately after merging:
```bash
# After merge is complete
git worktree remove ../ai-feature-name
git branch -d feature/ai-feature-name
```

## ⚡ Best Practices for Merging Concurrent Worktrees

### 1. Keep branches updated regularly

```bash
# In each worktree, regularly pull latest main
git fetch origin main
git rebase origin/main  # or merge if you prefer
```

### 2. Before merging, sync both worktrees

```bash
# In worktree 1
git add . && git commit -m "WIP: feature A"
git push origin feature-a

# In worktree 2
git add . && git commit -m "WIP: feature B"
git push origin feature-b
```

### 3. Merge one at a time into main

```bash
# Go to main worktree
cd /path/to/main-worktree
git checkout main
git pull origin main

# Merge first feature
git merge feature-a
git push origin main

# Then merge second feature (now with first changes)
git pull origin main  # Get the merged changes
git merge feature-b
git push origin main
```

### 4. Handle conflicts between features

If both worktrees modified the same files:

```bash
# After merging first feature, update second worktree
cd /path/to/feature-b-worktree
git fetch origin main
git rebase origin/main  # Resolve conflicts here
git push --force-with-lease origin feature-b

# Then merge clean feature-b into main
```

### 5. Alternative: Merge into integration branch first

```bash
# Create integration branch
git checkout -b integration/combined-features

# Merge both features
git merge feature-a
git merge feature-b  # Resolve conflicts once

# Test everything works together
npm test

# Then merge to main
git checkout main
git merge integration/combined-features
```

**The key is to regularly sync with main and communicate between worktrees to avoid conflicts!**

## 🚀 Quick Start

```bash
# Create a worktree for Phase 1 Agent Registry work
git worktree add ../nofx-phase1-agents -b feature/phase1-agents

# Create a worktree for bug fixes on main
git worktree add ../nofx-hotfix main

# Create a worktree for experimental sandbox features
git worktree add ../nofx-sandbox-experiment -b experiment/sandbox-isolation

# List all worktrees
git worktree list

# Remove a worktree when done
git worktree remove ../nofx-phase1-agents
```

## 📖 What Are Git Worktrees?

Git worktrees allow you to have multiple working directories attached to a single repository. Each worktree has its own:
- Working directory
- Index (staging area)
- HEAD pointer
- Branch checkout

All worktrees share:
- The same `.git` repository
- Object database (commits, trees, blobs)
- References (branches, tags)
- Configuration

## 🎯 Why Use Worktrees in NOFX?

### Perfect for NOFX Because:

1. **Parallel Phase Development**: Work on Phase 1 (Agent Registry) while Phase 2 (Safety & Sandbox) runs tests
2. **Isolated Agent Testing**: Each agent/template can be developed in isolation
3. **Safe Experimentation**: Test sandbox execution drivers without affecting main development
4. **Quick Context Switching**: Review PRs without stashing work
5. **CI/CD Integration**: Run gates and tests in separate worktrees
6. **Hot Reload Testing**: Keep dev server running while fixing bugs in another worktree

### Real NOFX Scenarios:

```bash
# Scenario 1: Developing Phase 1 while testing Phase 2
git worktree add ../nofx-phase1 feature/phase1-agents
git worktree add ../nofx-phase2 feature/phase2-safety

# Scenario 2: Testing agent templates in isolation
git worktree add ../nofx-agent-potpie feature/agent-potpie
git worktree add ../nofx-agent-swarm feature/agent-swarm

# Scenario 3: Running benchmarks without disrupting development
git worktree add ../nofx-benchmarks main
cd ../nofx-benchmarks && npm run benchmark:worfbench
```

## 🛠️ Basic Commands

### Creating Worktrees

```bash
# Create worktree from existing branch
git worktree add <path> <branch>
git worktree add ../nofx-responses feature/responses-ui

# Create worktree with new branch
git worktree add <path> -b <new-branch>
git worktree add ../nofx-newfeature -b feature/amazing-feature

# Create worktree from specific commit
git worktree add <path> <commit-hash>
git worktree add ../nofx-debug 567b2b9

# Create detached worktree (no branch)
git worktree add --detach <path>
git worktree add --detach ../nofx-experiment
```

### Managing Worktrees

```bash
# List all worktrees
git worktree list
git worktree list --porcelain  # Machine-readable format

# Move a worktree
git worktree move <old-path> <new-path>
git worktree move ../nofx-old ../nofx-new

# Remove a worktree
git worktree remove <path>
git worktree remove ../nofx-phase1

# Force remove (if worktree has uncommitted changes)
git worktree remove --force <path>

# Prune stale worktree references
git worktree prune
```

### Locking Worktrees

```bash
# Lock a worktree to prevent accidental removal
git worktree lock <path>
git worktree lock ../nofx-production

# Unlock a worktree
git worktree unlock <path>

# Lock with reason
git worktree lock --reason "Active production debugging" ../nofx-prod
```

## 💼 NOFX-Specific Workflows

### Workflow 1: Phase Development

```bash
# Setup worktrees for each phase
git worktree add ../nofx-phase1 -b feature/phase1-registries
git worktree add ../nofx-phase2 -b feature/phase2-safety
git worktree add ../nofx-phase3 -b feature/phase3-backlog

# Work on Phase 1
cd ../nofx-phase1
npm install
npm run validate:agents
npm run test -- --runInBand

# Meanwhile, run Phase 2 sandbox tests
cd ../nofx-phase2
npm run test:sandbox
npm run gates

# Review changes across phases
cd ../nofx-local-starter
git worktree list --porcelain | grep branch
```

### Workflow 2: Agent/Template Development

```bash
# Create isolated worktrees for each agent
git worktree add ../agents/potpie -b agent/potpie
git worktree add ../agents/swarm -b agent/swarm
git worktree add ../agents/ruler -b agent/ruler

# Develop Potpie agent
cd ../agents/potpie
mkdir -p packages/shared/agents/potpie
cat > packages/shared/agents/potpie/agent.json << 'EOF'
{
  "id": "potpie",
  "name": "Potpie Agent",
  "skills": ["code-analysis", "graph-building"],
  "resourceProfile": "standard"
}
EOF

# Test in isolation
npm run validate:agents
npm run test:agent -- potpie

# Merge when ready
git add .
git commit -m "feat: add potpie agent with graph analysis"
cd ../nofx-local-starter
git merge agent/potpie
```

### Workflow 3: Bug Fix Without Disrupting Feature Work

```bash
# You're working on a feature
cd ../nofx-local-starter
# ... lots of uncommitted changes ...

# Critical bug reported! Create hotfix worktree
git worktree add ../nofx-hotfix main

# Fix the bug
cd ../nofx-hotfix
vim src/worker/handlers/gate.ts
npm run test
git add .
git commit -m "fix: critical gate handler race condition"
git push origin main

# Return to feature work - nothing lost!
cd ../nofx-local-starter
# ... continue where you left off ...
```

### Workflow 4: Sandbox Execution Testing

```bash
# Create worktree for each execution driver
git worktree add ../exec/local -b feature/exec-local
git worktree add ../exec/docker -b feature/exec-docker
git worktree add ../exec/e2b -b feature/exec-e2b

# Test Docker execution
cd ../exec/docker
npm run test:docker
docker-compose up -d
npm run test:integration

# Test E2B execution (in parallel!)
cd ../exec/e2b
npm run test:e2b
```

### Workflow 5: PR Review

```bash
# Review a PR without losing your work
git fetch origin pull/123/head:pr-123
git worktree add ../review-pr-123 pr-123

cd ../review-pr-123
npm install
npm run lint
npm run test
# Add review comments...

# Cleanup
git worktree remove ../review-pr-123
```

## 🏗️ Project Structure

### Recommended Directory Layout

```
/Volumes/Development/
├── nofx-local-starter/          # Main development worktree
├── nofx-worktrees/              # Organized worktree container
│   ├── phases/
│   │   ├── phase1-agents/      # Phase 1 work
│   │   ├── phase2-safety/      # Phase 2 work
│   │   └── phase3-backlog/     # Phase 3 work
│   ├── agents/
│   │   ├── potpie/             # Potpie agent dev
│   │   ├── swarm/              # Swarm agent dev
│   │   └── ruler/              # Ruler agent dev
│   ├── experiments/
│   │   ├── sandbox-isolation/  # Sandbox experiments
│   │   └── event-bus/          # Event system tests
│   ├── fixes/
│   │   └── hotfix-gate/        # Current hotfix
│   └── reviews/
│       └── pr-456/             # PR review
```

### Setup Script

Create `scripts/setup-worktrees.sh`:

```bash
#!/bin/bash

# NOFX Worktree Setup Script

WORKTREE_BASE="../nofx-worktrees"

# Create base structure
mkdir -p "$WORKTREE_BASE"/{phases,agents,experiments,fixes,reviews}

# Setup phase worktrees
setup_phases() {
    echo "Setting up phase worktrees..."
    git worktree add "$WORKTREE_BASE/phases/phase1" -b feature/phase1
    git worktree add "$WORKTREE_BASE/phases/phase2" -b feature/phase2
    git worktree add "$WORKTREE_BASE/phases/phase3" -b feature/phase3
}

# Setup agent worktrees
setup_agents() {
    echo "Setting up agent worktrees..."
    for agent in potpie swarm ruler; do
        git worktree add "$WORKTREE_BASE/agents/$agent" -b "agent/$agent"
    done
}

# Run setup
setup_phases
setup_agents

echo "Worktree structure created!"
git worktree list
```

## ⚙️ Configuration

### Git Config for Worktrees

```bash
# Set worktree-specific config
cd ../nofx-phase1
git config user.email "phase1-dev@nofx.local"

# Global worktree settings
git config --global worktree.guessRemote true

# Automatic pruning
git config --global gc.worktreePruneExpire 3.days.ago
```

### Environment Variables

Each worktree needs its own `.env`:

```bash
# Copy and modify .env for each worktree
cd ../nofx-phase1
cp ../nofx-local-starter/.env .env
echo "NODE_ENV=phase1" >> .env
echo "PORT=3001" >> .env  # Different port!
```

### VS Code Multi-Worktree Setup

Create `.vscode/nofx.code-workspace`:

```json
{
  "folders": [
    { "path": "../nofx-local-starter", "name": "NOFX Main" },
    { "path": "../nofx-phase1", "name": "Phase 1" },
    { "path": "../nofx-phase2", "name": "Phase 2" },
    { "path": "../nofx-agents/potpie", "name": "Potpie Agent" }
  ],
  "settings": {
    "git.ignoredRepositories": [],
    "typescript.tsdk": "node_modules/typescript/lib"
  }
}
```

## 🚨 Common Issues & Solutions

### Issue 1: "fatal: branch already checked out"

```bash
# Problem: Can't checkout branch in multiple worktrees
git worktree add ../new feature/taken
# fatal: 'feature/taken' is already checked out at '../old'

# Solution: Use different branch or detached HEAD
git worktree add --detach ../new
cd ../new
git checkout -b feature/taken-copy
```

### Issue 2: Node Modules Confusion

```bash
# Problem: Wrong node_modules used across worktrees

# Solution: Clean install in each worktree
cd ../nofx-phase1
rm -rf node_modules package-lock.json
npm install

# Or use separate npm cache
npm install --cache ../nofx-phase1/.npm-cache
```

### Issue 3: Database/Redis Conflicts

```bash
# Problem: Multiple worktrees connecting to same DB/Redis

# Solution: Use different ports/databases
# In worktree 1 .env:
DATABASE_URL="postgresql://localhost:5432/nofx_phase1"
REDIS_PORT=6379

# In worktree 2 .env:
DATABASE_URL="postgresql://localhost:5432/nofx_phase2"
REDIS_PORT=6380
```

### Issue 4: Stale Worktree References

```bash
# Problem: Worktree deleted but Git still tracks it
git worktree list
# Shows deleted worktree

# Solution: Prune stale references
git worktree prune
git worktree list  # Fixed!
```

### Issue 5: Uncommitted Changes Blocking Removal

```bash
# Problem: Can't remove worktree with changes
git worktree remove ../nofx-experiment
# fatal: '../nofx-experiment' contains modified or untracked files

# Solution 1: Commit or stash changes
cd ../nofx-experiment
git stash push -m "Experiment WIP"
cd -
git worktree remove ../nofx-experiment

# Solution 2: Force removal (loses changes!)
git worktree remove --force ../nofx-experiment
```

## ✅ Best Practices

### 1. Naming Conventions

```bash
# Use descriptive paths that match the purpose
git worktree add ../nofx-feature-<name>    # Features
git worktree add ../nofx-fix-<issue>       # Bug fixes
git worktree add ../nofx-experiment-<name> # Experiments
git worktree add ../nofx-review-pr<num>    # PR reviews
git worktree add ../nofx-phase<num>        # Phase work
```

### 2. Branch Strategy

```bash
# Don't reuse branches across worktrees
# ❌ Bad
git worktree add ../work1 feature/shared
git worktree add ../work2 feature/shared  # Error!

# ✅ Good
git worktree add ../work1 feature/shared
git worktree add ../work2 feature/shared-parallel
```

### 3. Resource Isolation

```bash
# Each worktree should have isolated resources
# Different ports
PORT=3000  # main
PORT=3001  # phase1
PORT=3002  # phase2

# Different databases
DATABASE_NAME=nofx_main
DATABASE_NAME=nofx_phase1
DATABASE_NAME=nofx_phase2

# Different Redis databases
REDIS_DB=0  # main
REDIS_DB=1  # phase1
REDIS_DB=2  # phase2
```

### 4. Cleanup Discipline

```bash
# Remove worktrees when done
git worktree remove ../nofx-feature-complete

# Prune regularly
git worktree prune

# List and review periodically
git worktree list | grep -v main
```

### 5. Documentation

```bash
# Document active worktrees in team notes
cat > ACTIVE_WORKTREES.md << 'EOF'
# Active Worktrees

- `../nofx-phase1`: Ben working on Agent Registry (PR #123)
- `../nofx-phase2`: Sarah testing Sandbox isolation
- `../nofx-hotfix`: URGENT - Gate handler fix for production
EOF
```

## 🧹 Cleanup & Maintenance

### Regular Cleanup Script

Create `scripts/cleanup-worktrees.sh`:

```bash
#!/bin/bash

# NOFX Worktree Cleanup Script

echo "Current worktrees:"
git worktree list

echo -e "\nPruning stale worktrees..."
git worktree prune

echo -e "\nChecking for merged branches..."
for worktree in $(git worktree list --porcelain | grep "worktree" | cut -d' ' -f2); do
    if [ "$worktree" != "$(pwd)" ]; then
        branch=$(git worktree list --porcelain | grep -A2 "worktree $worktree" | grep branch | cut -d' ' -f2)
        if git branch --merged main | grep -q "$branch"; then
            echo "Branch $branch is merged. Remove worktree $worktree? (y/n)"
            read -r response
            if [ "$response" = "y" ]; then
                git worktree remove "$worktree"
            fi
        fi
    fi
done

echo -e "\nFinal worktree list:"
git worktree list
```

### Emergency Reset

If worktrees get corrupted:

```bash
# Backup current state
cp -r .git .git.backup

# Remove all worktrees forcefully
git worktree list --porcelain | grep "worktree" | cut -d' ' -f2 | \
    grep -v "$(pwd)" | xargs -I {} git worktree remove --force {}

# Prune everything
git worktree prune
git gc --aggressive

# Verify clean state
git worktree list  # Should only show main worktree
```

## Integration with NOFX Phases

### Phase 1: Agent Registry
```bash
git worktree add ../nofx-phase1-agents -b feature/phase1-agents
cd ../nofx-phase1-agents
# Develop agents in isolation with hot reload
npm run dev:agents
```

### Phase 2: Safety & Sandbox
```bash
git worktree add ../nofx-phase2-sandbox -b feature/phase2-sandbox
cd ../nofx-phase2-sandbox
# Test execution drivers separately
npm run test:drivers
```

### Phase 3: Backlog Intake
```bash
git worktree add ../nofx-phase3-backlog -b feature/phase3-backlog
cd ../nofx-phase3-backlog
# Work on spec parser without affecting other phases
npm run dev:parser
```

## Tips for AI Coders

When NOFX AI assistants are working:

1. **Always specify the worktree context** in prompts
2. **Check worktree status** before making changes
3. **Use isolated worktrees** for experimental changes
4. **Document worktree purpose** in commit messages
5. **Clean up worktrees** after task completion

Example AI instruction:
```
"Create a worktree for testing the new agent validation system.
Work in ../nofx-agent-validation and ensure all tests pass before merging."
```

---

*Last updated for NOFX Phase 1-3 requirements. See AI_CODER_GUIDE.md for general NOFX development practices.*