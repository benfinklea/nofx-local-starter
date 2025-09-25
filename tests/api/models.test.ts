import { callHandler, resetMocks } from './utils/testHelpers';

// Clear any existing module mocks
jest.unmock('../../src/lib/auth');
jest.unmock('../../src/lib/models');

// Mock dependencies
const mockIsAdmin = jest.fn();
const mockListModels = jest.fn();
const mockUpsertModel = jest.fn();
const mockDeleteModel = jest.fn();

jest.mock('../../src/lib/auth', () => ({
  isAdmin: mockIsAdmin,
}));

jest.mock('../../src/lib/models', () => ({
  listModels: mockListModels,
  upsertModel: mockUpsertModel,
  deleteModel: mockDeleteModel,
}));

// Import handlers after mocks
import modelsHandler from '../../api/models/index';
import modelHandler from '../../api/models/[id]';

describe('Models API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockIsAdmin.mockReset();
    mockIsAdmin.mockReturnValue(true);
  });

  describe('GET /api/models', () => {
    it('should list models', async () => {
      const mockModels = [
        { id: 'model-1', name: 'GPT-4', type: 'llm' },
        { id: 'model-2', name: 'Claude', type: 'llm' },
      ];
      mockListModels.mockResolvedValue(mockModels);

      const response = await callHandler(modelsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ models: mockModels });
      expect(mockListModels).toHaveBeenCalled();
    });

    it('should handle errors when listing models', async () => {
      mockListModels.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(modelsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions', async () => {
      mockListModels.mockRejectedValue('String error');

      const response = await callHandler(modelsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to list models' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(modelsHandler, {
        method: 'GET',
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('POST /api/models', () => {
    it('should create a model', async () => {
      const newModel = { id: 'model-123', name: 'Custom Model', provider: 'custom' };
      mockUpsertModel.mockResolvedValue(newModel);

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { name: 'Custom Model', provider: 'custom' },
      });

      expect(response.status).toBe(201);
      expect(response.json).toEqual(newModel);
      expect(mockUpsertModel).toHaveBeenCalledWith({ name: 'Custom Model', provider: 'custom' });
    });

    it('should handle missing name', async () => {
      mockUpsertModel.mockRejectedValue(new Error('name is required'));

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { provider: 'custom' },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'name is required' });
    });

    it('should handle validation errors', async () => {
      mockUpsertModel.mockRejectedValue(new Error('Validation error'));

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { name: 'Model' },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'Validation error' });
    });

    it('should handle creation errors', async () => {
      mockUpsertModel.mockRejectedValue(new Error('Creation failed'));

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { name: 'Model', provider: 'custom' },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'Creation failed' });
    });

    it('should handle non-Error exceptions', async () => {
      mockUpsertModel.mockRejectedValue('String error');

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { name: 'Model', provider: 'custom' },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'String error' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(modelsHandler, {
        method: 'POST',
        body: { name: 'Model', type: 'custom' },
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('DELETE /api/models/[id]', () => {
    it('should delete a model', async () => {
      mockDeleteModel.mockResolvedValue(undefined);

      const response = await callHandler(modelHandler, {
        method: 'DELETE',
        query: { id: 'model-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ ok: true });
      expect(mockDeleteModel).toHaveBeenCalledWith('model-123');
    });

    it('should handle deletion errors', async () => {
      mockDeleteModel.mockRejectedValue(new Error('Cannot delete'));

      const response = await callHandler(modelHandler, {
        method: 'DELETE',
        query: { id: 'model-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Cannot delete' });
    });

    it('should handle non-Error exceptions', async () => {
      mockDeleteModel.mockRejectedValue('String error');

      const response = await callHandler(modelHandler, {
        method: 'DELETE',
        query: { id: 'model-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to delete model' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(modelHandler, {
        method: 'DELETE',
        query: { id: 'model-123' },
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('Method validation', () => {
    it('should reject PATCH requests to models endpoint', async () => {
      const response = await callHandler(modelsHandler, {
        method: 'PATCH',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET requests to model endpoint', async () => {
      const response = await callHandler(modelHandler, {
        method: 'GET',
        query: { id: 'model-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject POST requests to model endpoint', async () => {
      const response = await callHandler(modelHandler, {
        method: 'POST',
        query: { id: 'model-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});