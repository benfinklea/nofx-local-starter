-- Add git_mode and initialized fields to project table
ALTER TABLE nofx.project
ADD COLUMN IF NOT EXISTS git_mode TEXT DEFAULT 'hidden' CHECK (git_mode IN ('hidden', 'basic', 'advanced')),
ADD COLUMN IF NOT EXISTS initialized BOOLEAN DEFAULT false;

-- Create index for workspace_mode to optimize queries for clone/worktree projects
CREATE INDEX IF NOT EXISTS idx_project_workspace_mode ON nofx.project(workspace_mode);

-- Create index for initialized to find uninitialized projects quickly
CREATE INDEX IF NOT EXISTS idx_project_initialized ON nofx.project(initialized);

-- Add comment documenting the new fields
COMMENT ON COLUMN nofx.project.git_mode IS 'User experience level for git operations: hidden (default), basic, or advanced';
COMMENT ON COLUMN nofx.project.initialized IS 'Whether the project workspace has been initialized (repo created/cloned)';