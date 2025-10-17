import type { StepHandler } from "./types";
import type { JsonValue } from "../../lib/store/types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { getProject } from "../../lib/projects";
import { workspaceManager } from "../../lib/workspaces";
import { log } from "../../lib/logger";

interface ProjectInitInputs {
  project_id: string;
  template?: 'ecommerce' | 'saas' | 'blog' | 'portfolio' | 'blank';
  force?: boolean; // Force re-initialization
}

const handler: StepHandler = {
  match: (tool) => tool === 'project_init',

  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    try {
      const inputs = step.inputs as ProjectInitInputs;

      if (!inputs?.project_id) {
        throw new Error('project_id is required');
      }

      // Get project details
      const project = await getProject(inputs.project_id);
      if (!project) {
        throw new Error(`Project ${inputs.project_id} not found`);
      }

      // Check if already initialized (unless force flag is set)
      if (project.initialized && !inputs.force) {
        const outputs = {
          message: 'Project already initialized',
          workspace: workspaceManager.getWorkspacePath(project),
          initialized: true
        };

        await store.updateStep(stepId, {
          status: 'succeeded',
          ended_at: new Date().toISOString(),
          outputs
        });
        await recordEvent(runId, 'step.finished', { outputs }, stepId);
        return;
      }

      // Initialize workspace
      log.info({ projectId: project.id, mode: project.workspace_mode }, 'Initializing project workspace');

      const workspacePath = await workspaceManager.ensureWorkspace(project);

      // Apply template if specified and it's a new repo
      if (inputs.template && !project.repo_url) {
        await applyTemplate(project, workspacePath, inputs.template);
      }

      // Auto-commit if changes were made
      if (!project.repo_url) {
        const commitMessage = inputs.template
          ? `Initialize ${project.name} with ${inputs.template} template`
          : `Initialize ${project.name}`;

        await workspaceManager.autoCommit(project, commitMessage);
      }

      // Get status
      const status = await workspaceManager.getStatus(project);

      const outputs = {
        message: project.repo_url
          ? `Cloned repository for ${project.name}`
          : `Initialized new project ${project.name}`,
        workspace: workspacePath,
        template: inputs.template || null,
        git_status: status as JsonValue,
        initialized: true
      };

      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.finished', { outputs }, stepId);

    } catch (error) {
      const outputs = {
        error: error instanceof Error ? error.message : 'Unknown error',
        project_id: (step.inputs as any)?.project_id
      };

      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.failed', { outputs, error: outputs.error }, stepId);
    }
  }
};

/**
 * Apply a template to a new project
 */
async function applyTemplate(project: any, workspacePath: string, template: string): Promise<void> {
  const fs = (await import('fs')).promises;
  const path = (await import('path')).default;

  log.info({ projectId: project.id, template }, 'Applying project template');

  // Create basic structure based on template
  switch (template) {
    case 'ecommerce':
      await createEcommerceTemplate(fs, path, workspacePath, project.name);
      break;
    case 'saas':
      await createSaasTemplate(fs, path, workspacePath, project.name);
      break;
    case 'blog':
      await createBlogTemplate(fs, path, workspacePath, project.name);
      break;
    case 'portfolio':
      await createPortfolioTemplate(fs, path, workspacePath, project.name);
      break;
    case 'blank':
    default:
      // Basic structure already created by WorkspaceManager
      break;
  }
}

async function createEcommerceTemplate(fs: any, path: any, workspacePath: string, projectName: string) {
  // Create directories
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspacePath, 'public'), { recursive: true });

  // Create package.json
  const packageJson = {
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: `${projectName} - E-commerce Store`,
    scripts: {
      dev: 'echo "Development server"',
      build: 'echo "Building for production"',
      start: 'echo "Starting production server"'
    }
  };
  await fs.writeFile(
    path.join(workspacePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create README
  const readme = `# ${projectName}

An e-commerce store built with NOFX.

## Features
- Product catalog
- Shopping cart
- Checkout flow
- Payment processing

## Getting Started
1. Install dependencies: \`npm install\`
2. Run development server: \`npm run dev\`
3. Build for production: \`npm run build\`
`;
  await fs.writeFile(path.join(workspacePath, 'README.md'), readme);

  // Create basic HTML
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${projectName} - Online Store</title>
</head>
<body>
  <h1>Welcome to ${projectName}</h1>
  <p>Your online store is being set up...</p>
</body>
</html>`;
  await fs.writeFile(path.join(workspacePath, 'public', 'index.html'), indexHtml);
}

async function createSaasTemplate(fs: any, path: any, workspacePath: string, projectName: string) {
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });

  const readme = `# ${projectName}

A SaaS application built with NOFX.

## Features
- User authentication
- Subscription management
- Dashboard
- API integration

## Getting Started
1. Set up environment variables
2. Install dependencies
3. Run the application
`;
  await fs.writeFile(path.join(workspacePath, 'README.md'), readme);
}

async function createBlogTemplate(fs: any, path: any, workspacePath: string, projectName: string) {
  await fs.mkdir(path.join(workspacePath, 'content'), { recursive: true });

  const readme = `# ${projectName}

A blog built with NOFX.

## Features
- Article management
- Categories and tags
- Comments
- RSS feed

## Writing Content
Add your articles to the \`content\` directory.
`;
  await fs.writeFile(path.join(workspacePath, 'README.md'), readme);
}

async function createPortfolioTemplate(fs: any, path: any, workspacePath: string, projectName: string) {
  await fs.mkdir(path.join(workspacePath, 'projects'), { recursive: true });

  const readme = `# ${projectName}

A portfolio website built with NOFX.

## Sections
- About
- Projects
- Skills
- Contact

## Adding Projects
Add your project descriptions to the \`projects\` directory.
`;
  await fs.writeFile(path.join(workspacePath, 'README.md'), readme);
}

export default handler;