import projectsHandler from '../../api/projects/index';
import projectHandler from '../../api/projects/[id]';
import { callHandler, factories, resetMocks } from './utils/testHelpers';

// Mock dependencies - declare before using in jest.mock
const mockListProjects = jest.fn();
const mockCreateProject = jest.fn();
const mockGetProject = jest.fn();
const mockUpdateProject = jest.fn();
const mockDeleteProject = jest.fn();

jest.mock('../../src/lib/projects', () => {
  // Return the mock functions directly
  return {
    listProjects: jest.fn(),
    createProject: jest.fn(),
    getProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  };
});

// Get the mocked module
const projectsModule = require('../../src/lib/projects');
// Assign our mock functions
Object.assign(projectsModule, {
  listProjects: mockListProjects,
  createProject: mockCreateProject,
  getProject: mockGetProject,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
});

jest.mock('../../src/lib/auth', () => ({
  isAdmin: () => true,
}));

describe('Projects API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('should list all projects', async () => {
      const mockProjects = [
        factories.project(),
        factories.project({ id: 'project-456', name: 'Another Project' }),
      ];
      mockListProjects.mockResolvedValue(mockProjects);

      const response = await callHandler(projectsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ projects: mockProjects });
      expect(mockListProjects).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      // Temporarily mock isAdmin to return false
      const authModule = require('../../src/lib/auth');
      const originalIsAdmin = authModule.isAdmin;
      authModule.isAdmin = jest.fn().mockReturnValue(false);

      const response = await callHandler(projectsHandler, {
        method: 'GET',
        authenticated: false,
      });

      // Restore original mock
      authModule.isAdmin = originalIsAdmin;

      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required' });
    });

    it('should handle errors', async () => {
      mockListProjects.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(projectsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const newProject = factories.project();
      mockCreateProject.mockResolvedValue(newProject);

      const response = await callHandler(projectsHandler, {
        method: 'POST',
        body: {
          name: 'Test Project',
          repo_url: 'https://github.com/test/repo',
        },
      });

      expect(response.status).toBe(201);
      expect(response.json).toEqual(newProject);
      expect(mockCreateProject).toHaveBeenCalled();
    });

    it('should validate input', async () => {
      const response = await callHandler(projectsHandler, {
        method: 'POST',
        body: {
          // Missing required 'name' field
          repo_url: 'https://github.com/test/repo',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle optional fields', async () => {
      const newProject = factories.project();
      mockCreateProject.mockResolvedValue(newProject);

      const response = await callHandler(projectsHandler, {
        method: 'POST',
        body: {
          name: 'Test Project',
          repo_url: 'https://github.com/test/repo',
          local_path: '/path/to/project',
          workspace_mode: 'local_path',
          default_branch: 'main',
        },
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/projects/[id]', () => {
    it('should get a specific project', async () => {
      const mockProject = factories.project();
      mockGetProject.mockResolvedValue(mockProject);

      const response = await callHandler(projectHandler, {
        method: 'GET',
        query: { id: 'project-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(mockProject);
      expect(mockGetProject).toHaveBeenCalledWith('project-123');
    });

    it('should return 404 for non-existent project', async () => {
      mockGetProject.mockResolvedValue(null);

      const response = await callHandler(projectHandler, {
        method: 'GET',
        query: { id: 'non-existent' },
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'not found' });
    });
  });

  describe('PATCH /api/projects/[id]', () => {
    it('should update a project', async () => {
      const updatedProject = factories.project({ name: 'Updated Name' });
      mockUpdateProject.mockResolvedValue(updatedProject);

      const response = await callHandler(projectHandler, {
        method: 'PATCH',
        query: { id: 'project-123' },
        body: {
          name: 'Updated Name',
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(updatedProject);
      expect(mockUpdateProject).toHaveBeenCalledWith('project-123', expect.any(Object));
    });

    it('should validate partial updates', async () => {
      const response = await callHandler(projectHandler, {
        method: 'PATCH',
        query: { id: 'project-123' },
        body: {
          repo_url: 'not-a-valid-url',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });
  });

  describe('DELETE /api/projects/[id]', () => {
    it('should delete a project', async () => {
      mockDeleteProject.mockResolvedValue(undefined);

      const response = await callHandler(projectHandler, {
        method: 'DELETE',
        query: { id: 'project-123' },
      });

      expect(response.status).toBe(204);
      expect(response.data).toBe('');
      expect(mockDeleteProject).toHaveBeenCalledWith('project-123');
    });

    it('should require authentication', async () => {
      // Temporarily mock isAdmin to return false
      const authModule = require('../../src/lib/auth');
      const originalIsAdmin = authModule.isAdmin;
      authModule.isAdmin = jest.fn().mockReturnValue(false);

      const response = await callHandler(projectHandler, {
        method: 'DELETE',
        query: { id: 'project-123' },
        authenticated: false,
      });

      // Restore original mock
      authModule.isAdmin = originalIsAdmin;

      expect(response.status).toBe(401);
    });

    it('should handle errors', async () => {
      mockDeleteProject.mockRejectedValue(new Error('Cannot delete project with active runs'));

      const response = await callHandler(projectHandler, {
        method: 'DELETE',
        query: { id: 'project-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Cannot delete project with active runs' });
    });
  });

  describe('Method validation', () => {
    it('should reject unsupported methods for /api/projects', async () => {
      const response = await callHandler(projectsHandler, {
        method: 'DELETE',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject unsupported methods for /api/projects/[id]', async () => {
      const response = await callHandler(projectHandler, {
        method: 'POST',
        query: { id: 'project-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});