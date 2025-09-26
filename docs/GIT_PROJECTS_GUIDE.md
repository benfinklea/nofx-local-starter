# Git-Backed Projects Guide

This guide explains how NOFX Control Plane integrates git for version control with progressive disclosure - simple for entrepreneurs, powerful for developers.

## Overview

NOFX projects can now be backed by git repositories, providing:
- **Automatic version control** - Never lose work
- **Progressive disclosure** - Hide complexity from non-technical users
- **Full git power** - Available when needed

## Architecture

### Components

1. **WorkspaceManager** (`src/lib/workspaces.ts`)
   - Manages project workspaces in `/local_data/workspaces/`
   - Handles repo initialization and cloning
   - Auto-commits changes
   - Uses `simple-git` library

2. **Project Model Extensions**
   - `workspace_mode`: 'local_path' | 'clone' | 'worktree'
   - `git_mode`: 'hidden' | 'basic' | 'advanced'
   - `initialized`: boolean flag

3. **New Handlers**
   - `project_init`: Initialize or clone project repositories
   - `git_ops`: Adaptive git operations based on user mode

## User Experience Modes

### Hidden Mode (Default)
For non-technical entrepreneurs. Git is completely invisible.

**What users see:**
- "Save Progress"
- "Restore Previous Version"
- "Update Project"

**What happens behind the scenes:**
- Auto-commits with friendly messages
- Git pull/push operations
- Version tracking

**Example API usage:**
```json
{
  "tool": "git_ops",
  "inputs": {
    "project_id": "my-store",
    "operation": "save"
  }
}
```
Result: Auto-commits with message "Saved progress for My Store - 1/1/2024 10:30 AM"

### Basic Mode
For users learning version control.

**What users see:**
- "Save Progress (commit)"
- Version numbers
- Branch names (simplified)
- "Sync with Remote"

**Example API usage:**
```json
{
  "tool": "git_ops",
  "inputs": {
    "project_id": "my-store",
    "operation": "save",
    "message": "Added shopping cart feature"
  }
}
```
Result: Commits with user's message, returns commit hash

### Advanced Mode
For developers who want full git control.

**What users see:**
- Full git terminology
- All git operations available
- Branch management
- Merge capabilities

**Example API usage:**
```json
{
  "tool": "git_ops",
  "inputs": {
    "project_id": "my-store",
    "operation": "commit",
    "message": "feat: implement cart with Redux\n\n- Add cart reducer\n- Create UI components",
    "files": ["src/cart/*"],
    "options": {"--no-verify": true}
  }
}
```

## API Reference

### Create Project with Git

```bash
POST /projects
{
  "name": "My E-commerce Store",
  "workspace_mode": "clone",
  "git_mode": "hidden",  # or "basic", "advanced"
  "repo_url": "https://github.com/user/repo.git"  # Optional
}
```

If `repo_url` is provided, the repository will be cloned.
If not, a new git repository will be initialized.

### Initialize Project Workspace

```bash
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "project_init",
      "inputs": {
        "project_id": "p_abc123",
        "template": "ecommerce"  # Optional: ecommerce, saas, blog, portfolio
      }
    }]
  }
}
```

### Git Operations

```bash
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "git_ops",
      "inputs": {
        "project_id": "p_abc123",
        "operation": "save",  # or sync, branch, revert, status, etc.
        "message": "Optional commit message"
      }
    }]
  }
}
```

## Workflow Examples

### Example 1: Non-Technical User Creates Project

```javascript
// 1. Create project
POST /projects
{
  "name": "Jewelry Store",
  "workspace_mode": "clone",
  "git_mode": "hidden"
}

// 2. Initialize with template
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "project_init",
      "inputs": {
        "project_id": "p_jewelry",
        "template": "ecommerce"
      }
    }]
  }
}

// 3. Work happens, auto-save
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "git_ops",
      "inputs": {
        "project_id": "p_jewelry",
        "operation": "save"
      }
    }]
  }
}
// Result: "Progress saved successfully"
```

### Example 2: Developer Uses Full Git

```javascript
// 1. Create project with advanced mode
POST /projects
{
  "name": "SaaS Platform",
  "workspace_mode": "clone",
  "repo_url": "git@github.com:company/platform.git",
  "git_mode": "advanced"
}

// 2. Create feature branch
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "git_ops",
      "inputs": {
        "project_id": "p_saas",
        "operation": "checkout",
        "branch_name": "feature/auth",
        "create_new": true
      }
    }]
  }
}

// 3. Commit with conventional message
POST /runs
{
  "plan": {
    "steps": [{
      "tool": "git_ops",
      "inputs": {
        "project_id": "p_saas",
        "operation": "commit",
        "message": "feat(auth): add OAuth2 integration",
        "files": ["src/auth/**"]
      }
    }]
  }
}
```

## Handler Integration

All handlers can now work within project workspaces:

### Bash Handler
```json
{
  "tool": "bash",
  "inputs": {
    "project_id": "p_abc123",
    "command": "npm install"
  }
}
```
Executes in project workspace automatically.

### Codegen Handler
```json
{
  "tool": "codegen",
  "inputs": {
    "project_id": "p_abc123",
    "prompt": "Create a shopping cart component"
  }
}
```
Generates code in project workspace, auto-commits if successful.

## Security Considerations

1. **Workspace Isolation**: Each project gets its own sandboxed directory
2. **Authentication**: GitHub tokens stored in environment variables
3. **Repository Allowlist**: Can restrict which repos can be cloned
4. **Cleanup**: Workspaces can be auto-deleted after use

## Migration Guide

### Existing Projects
Existing projects with `workspace_mode: 'local_path'` continue to work unchanged.

To migrate to git-backed:
1. Update project: `PATCH /projects/{id}` with `workspace_mode: 'clone'`
2. Run `project_init` handler to initialize git

### Database Migration
Run the migration in `supabase/migrations/20250926000000_add_project_git_fields.sql` to add:
- `git_mode` column
- `initialized` column

## Configuration

### Environment Variables
```bash
# Workspace location (default: ./local_data/workspaces)
WORKSPACE_ROOT=/var/nofx/workspaces

# Git authentication
GITHUB_TOKEN=ghp_xxxxx
GIT_TOKEN=xxxxx  # Alternative to GITHUB_TOKEN
```

### Templates Available
- `ecommerce` - Online store starter
- `saas` - SaaS application starter
- `blog` - Blog/content site starter
- `portfolio` - Portfolio website starter
- `blank` - Empty project with just README

## Troubleshooting

### "Project not initialized"
Run the `project_init` handler to set up the workspace.

### "Cannot sync - not a git repository"
The project workspace wasn't properly initialized. Re-run `project_init`.

### "Pull failed, workspace may be ahead of remote"
Local changes haven't been pushed. In advanced mode, push changes first.

### "Stash pop failed"
Manual intervention needed - uncommitted changes conflict with pulled changes.

## Future Enhancements

- [ ] Worktree support for parallel development
- [ ] Conflict resolution UI for basic mode
- [ ] GitHub PR creation from UI
- [ ] Branch visualization for basic mode
- [ ] Automatic GitHub repo creation
- [ ] Team collaboration features

## Technical Implementation Details

### WorkspaceManager Methods

- `ensureWorkspace(project)` - Initialize or verify workspace
- `initializeRepo(project)` - Create new git repo
- `cloneRepo(project)` - Clone from remote
- `syncWorkspace(project)` - Pull latest changes
- `autoCommit(project, message)` - Commit with appropriate message for mode
- `getStatus(project)` - Get git status adapted to user's mode
- `cleanupWorkspace(project)` - Remove workspace directory

### Git Operations by Mode

| Operation | Hidden Mode | Basic Mode | Advanced Mode |
|-----------|------------|------------|---------------|
| Save | Auto-commit with timestamp | Commit with user message | Full commit control |
| Sync | Simple pull | Pull with status | Pull/push with options |
| Branch | Not available | Create/switch branches | Full branch management |
| Revert | Go back X versions | Revert to commit | Reset with options |
| Status | "X files changed" | Branch, changes, ahead/behind | Full git status |

## Summary

This implementation provides a complete git integration that scales with user expertise:
- **Entrepreneurs** get automatic versioning without seeing git
- **Growing users** learn version control concepts gradually
- **Developers** have full git power when needed

All while maintaining the NOFX philosophy of making complex things simple.