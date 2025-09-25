import { callHandler, resetMocks } from './utils/testHelpers';

// Clear any existing module mocks
jest.unmock('../../src/lib/auth');
jest.unmock('../../src/lib/backup');

// Mock dependencies
const mockIsAdmin = jest.fn();
const mockListBackups = jest.fn();
const mockCreateBackup = jest.fn();
const mockRestoreBackup = jest.fn();

jest.mock('../../src/lib/auth', () => ({
  isAdmin: mockIsAdmin,
}));

jest.mock('../../src/lib/backup', () => ({
  listBackups: mockListBackups,
  createBackup: mockCreateBackup,
  restoreBackup: mockRestoreBackup,
}));

// Import handlers after mocks
import backupsHandler from '../../api/backups/index';
import restoreHandler from '../../api/backups/[id]/restore';

describe('Backups API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockIsAdmin.mockReset();
    mockIsAdmin.mockReturnValue(true);
  });

  describe('GET /api/backups', () => {
    it('should list backups', async () => {
      const mockBackups = [
        { id: 'backup-1', created_at: '2023-01-01', size: 1024 },
        { id: 'backup-2', created_at: '2023-01-02', size: 2048 },
      ];
      mockListBackups.mockResolvedValue(mockBackups);

      const response = await callHandler(backupsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(mockBackups);
      expect(mockListBackups).toHaveBeenCalled();
    });

    it('should handle errors when listing backups', async () => {
      mockListBackups.mockRejectedValue(new Error('Storage error'));

      const response = await callHandler(backupsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Storage error' });
    });

    it('should handle non-Error exceptions', async () => {
      mockListBackups.mockRejectedValue('String error');

      const response = await callHandler(backupsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to list backups' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(backupsHandler, {
        method: 'GET',
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('POST /api/backups', () => {
    it('should create a backup', async () => {
      const mockBackup = {
        id: 'backup-123',
        created_at: new Date().toISOString(),
        size: 4096,
      };
      mockCreateBackup.mockResolvedValue(mockBackup);

      const response = await callHandler(backupsHandler, {
        method: 'POST',
        body: { note: 'Manual backup' },
      });

      expect(response.status).toBe(201);
      expect(response.json).toEqual(mockBackup);
      expect(mockCreateBackup).toHaveBeenCalledWith('Manual backup', 'data');
    });

    it('should handle missing description', async () => {
      const mockBackup = {
        id: 'backup-123',
        created_at: new Date().toISOString(),
      };
      mockCreateBackup.mockResolvedValue(mockBackup);

      const response = await callHandler(backupsHandler, {
        method: 'POST',
        body: {},
      });

      expect(response.status).toBe(201);
      expect(mockCreateBackup).toHaveBeenCalledWith(undefined, 'data');
    });

    it('should handle creation errors', async () => {
      mockCreateBackup.mockRejectedValue(new Error('Backup failed'));

      const response = await callHandler(backupsHandler, {
        method: 'POST',
        body: { note: 'Test' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Backup failed' });
    });

    it('should handle non-Error exceptions', async () => {
      mockCreateBackup.mockRejectedValue('String error');

      const response = await callHandler(backupsHandler, {
        method: 'POST',
        body: {},
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'String error' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(backupsHandler, {
        method: 'POST',
        body: {},
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('POST /api/backups/[id]/restore', () => {
    it('should restore a backup', async () => {
      mockRestoreBackup.mockResolvedValue({ success: true });

      const response = await callHandler(restoreHandler, {
        method: 'POST',
        query: { id: 'backup-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ ok: true, meta: { success: true } });
      expect(mockRestoreBackup).toHaveBeenCalledWith('backup-123');
    });

    it('should handle restore errors', async () => {
      mockRestoreBackup.mockRejectedValue(new Error('Restore failed'));

      const response = await callHandler(restoreHandler, {
        method: 'POST',
        query: { id: 'backup-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Restore failed' });
    });

    it('should handle non-Error exceptions', async () => {
      mockRestoreBackup.mockRejectedValue('String error');

      const response = await callHandler(restoreHandler, {
        method: 'POST',
        query: { id: 'backup-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'String error' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(restoreHandler, {
        method: 'POST',
        query: { id: 'backup-123' },
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });
  });

  describe('Method validation', () => {
    it('should reject PUT requests to backups endpoint', async () => {
      const response = await callHandler(backupsHandler, {
        method: 'PUT',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET requests to restore endpoint', async () => {
      const response = await callHandler(restoreHandler, {
        method: 'GET',
        query: { id: 'backup-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});