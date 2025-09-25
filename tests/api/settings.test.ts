import { callHandler, resetMocks } from './utils/testHelpers';

// Clear any existing module mocks
jest.unmock('../../src/lib/auth');
jest.unmock('../../src/lib/settings');
jest.unmock('../../src/lib/cache');
jest.unmock('../../src/lib/models');
jest.unmock('../../src/lib/db');
jest.unmock('../../src/lib/autobackup');

// Mock dependencies
const mockGetSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockIsAdmin = jest.fn();

jest.mock('../../src/lib/auth', () => ({
  isAdmin: mockIsAdmin,
}));

jest.mock('../../src/lib/settings', () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
}));

const mockInvalidateNamespace = jest.fn();

jest.mock('../../src/lib/cache', () => ({
  invalidateNamespace: mockInvalidateNamespace,
}));

const mockListModels = jest.fn();

jest.mock('../../src/lib/models', () => ({
  listModels: mockListModels,
}));

const mockQuery = jest.fn();

jest.mock('../../src/lib/db', () => ({
  query: mockQuery,
}));

const mockConfigureAutoBackup = jest.fn();

jest.mock('../../src/lib/autobackup', () => ({
  configureAutoBackup: mockConfigureAutoBackup,
}));

// Import handler after mocks
import settingsHandler from '../../api/settings/index';

describe('Settings API Endpoint', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockGetSettings.mockReset();
    mockUpdateSettings.mockReset();
    mockIsAdmin.mockReset();
    mockQuery.mockReset();
    mockListModels.mockReset();
    mockInvalidateNamespace.mockReset();
    mockConfigureAutoBackup.mockReset();
    // Default to authenticated
    mockIsAdmin.mockReturnValue(true);
    // Default query response
    mockQuery.mockResolvedValue({ rows: [] });
    // Default models response
    mockListModels.mockResolvedValue([]);
  });

  describe('GET /api/settings', () => {
    it('should get settings successfully', async () => {
      const mockSettings = {
        theme: 'dark',
        notifications: true,
        language: 'en',
      };
      mockGetSettings.mockResolvedValue(mockSettings);

      const response = await callHandler(settingsHandler, {
        method: 'GET',
        authenticated: true,
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({
        settings: mockSettings,
        db_write_rules: [],
        models: [],
      });
      expect(mockGetSettings).toHaveBeenCalled();
    });

    it('should handle errors when getting settings', async () => {
      mockGetSettings.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(settingsHandler, {
        method: 'GET',
        authenticated: true,
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSettings.mockRejectedValue('String error');

      const response = await callHandler(settingsHandler, {
        method: 'GET',
        authenticated: true,
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to get settings' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(settingsHandler, {
        method: 'GET',
        authenticated: false,
      });

      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });

    it('should handle db_write_rules query failure', async () => {
      const mockSettings = { theme: 'dark' };
      mockGetSettings.mockResolvedValue(mockSettings);
      // Make query fail - should catch and return empty array
      mockQuery.mockRejectedValueOnce(new Error('Database error'));
      mockListModels.mockResolvedValue([{ id: 'model1', name: 'Model 1' }]);

      const response = await callHandler(settingsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({
        settings: mockSettings,
        db_write_rules: [], // Should be empty due to caught error
        models: [{ id: 'model1', name: 'Model 1' }],
      });
    });

    it('should handle listModels failure', async () => {
      const mockSettings = { theme: 'dark' };
      mockGetSettings.mockResolvedValue(mockSettings);
      mockQuery.mockResolvedValue({ rows: [{ table_name: 'users', allowed_ops: ['SELECT'] }] });
      // Make listModels fail - should catch and return empty array
      mockListModels.mockRejectedValueOnce(new Error('Models service error'));

      const response = await callHandler(settingsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({
        settings: mockSettings,
        db_write_rules: [{ table_name: 'users', allowed_ops: ['SELECT'] }],
        models: [], // Should be empty due to caught error
      });
    });

    it('should handle both db_write_rules and listModels failures', async () => {
      const mockSettings = { theme: 'dark' };
      mockGetSettings.mockResolvedValue(mockSettings);
      mockQuery.mockRejectedValueOnce(new Error('Database error'));
      mockListModels.mockRejectedValueOnce(new Error('Models error'));

      const response = await callHandler(settingsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({
        settings: mockSettings,
        db_write_rules: [], // Empty due to error
        models: [], // Empty due to error
      });
    });
  });

  describe('POST /api/settings', () => {
    it('should update settings successfully', async () => {
      const updates = {
        theme: 'light',
        notifications: false,
      };
      const updatedSettings = {
        ...updates,
        language: 'en',
      };
      mockUpdateSettings.mockResolvedValue(updatedSettings);

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: updates },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ ok: true, settings: updatedSettings });
      expect(mockUpdateSettings).toHaveBeenCalledWith(updates);
    });


    it('should handle empty body', async () => {
      mockUpdateSettings.mockResolvedValue({});

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: {},
      });

      // Empty body is valid - updates nothing
      expect(response.status).toBe(200);
      expect(response.json).toEqual({ ok: true, settings: {} });
      expect(mockUpdateSettings).toHaveBeenCalledWith({});
    });

    it('should handle update errors', async () => {
      mockUpdateSettings.mockRejectedValue(new Error('Update failed'));

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { theme: 'dark' } },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Update failed' });
    });

    it('should handle non-Error exceptions', async () => {
      mockUpdateSettings.mockRejectedValue('String error');

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { theme: 'dark' } },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to update settings' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { theme: 'dark' } },
        authenticated: false,
      });

      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });

    it('should handle db_write_rules updates', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const rules = [
        { table_name: 'users', allowed_ops: ['SELECT', 'INSERT'], constraints: { tenant_id: 'local' } },
        { table_name: 'posts', allowed_ops: ['SELECT'], constraints: {} },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      expect(response.status).toBe(200);
      // Should have called delete once
      expect(mockQuery).toHaveBeenCalledWith(
        `delete from nofx.db_write_rule where tenant_id='local'`
      );
      // Should have called insert for each rule
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['users', ['SELECT', 'INSERT'], { tenant_id: 'local' }]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['posts', ['SELECT'], {}]
      );
    });

    it('should handle malformed db_write_rules', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const rules = [
        { table_name: 'valid', allowed_ops: ['SELECT'] },
        { /* missing table_name */ allowed_ops: ['SELECT'] },
        { table_name: 'missing_ops' /* missing allowed_ops */ },
        null,
        { table_name: 'also_valid', allowed_ops: ['INSERT'] },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      expect(response.status).toBe(200);
      // Should only insert valid rules
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['valid', ['SELECT'], {}]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['also_valid', ['INSERT'], {}]
      );
      // Should not have been called for invalid rules
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('insert'),
        expect.arrayContaining(['missing_ops'])
      );
    });

    it('should handle db_write_rules delete failure', async () => {
      mockUpdateSettings.mockResolvedValue({});
      // Make delete fail
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const rules = [
        { table_name: 'users', allowed_ops: ['SELECT'] },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      // Should still succeed (errors are caught)
      expect(response.status).toBe(200);
      // Should still try to insert after delete fails
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['users', ['SELECT'], {}]
      );
    });

    it('should handle db_write_rules insert failure', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // delete succeeds
        .mockRejectedValueOnce(new Error('Insert failed')); // insert fails

      const rules = [
        { table_name: 'users', allowed_ops: ['SELECT'] },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      // Should still succeed (errors are caught)
      expect(response.status).toBe(200);
    });

    it('should handle empty db_write_rules array', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: [] },
      });

      expect(response.status).toBe(200);
      // Should call delete to clear all rules
      expect(mockQuery).toHaveBeenCalledWith(
        `delete from nofx.db_write_rule where tenant_id='local'`
      );
      // Should not call any inserts
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('insert'),
        expect.anything()
      );
    });

    it('should configure auto backup when backupIntervalMin is set', async () => {
      const updatedSettings = {
        theme: 'dark',
        ops: { backupIntervalMin: 60 }
      };
      mockUpdateSettings.mockResolvedValue(updatedSettings);
      mockConfigureAutoBackup.mockResolvedValue(undefined);

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { ops: { backupIntervalMin: 60 } } },
      });

      expect(response.status).toBe(200);
      expect(mockConfigureAutoBackup).toHaveBeenCalledWith(60);
    });

    it('should handle auto backup configuration failure', async () => {
      const updatedSettings = {
        theme: 'dark',
        ops: { backupIntervalMin: 30 }
      };
      mockUpdateSettings.mockResolvedValue(updatedSettings);
      mockConfigureAutoBackup.mockRejectedValue(new Error('Backup config failed'));

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { ops: { backupIntervalMin: 30 } } },
      });

      // Should still succeed (error is caught)
      expect(response.status).toBe(200);
      expect(mockConfigureAutoBackup).toHaveBeenCalledWith(30);
    });

    it('should invalidate cache after settings update', async () => {
      mockUpdateSettings.mockResolvedValue({ theme: 'light' });
      mockInvalidateNamespace.mockResolvedValue(undefined);

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { theme: 'light' } },
      });

      expect(response.status).toBe(200);
      expect(mockInvalidateNamespace).toHaveBeenCalledWith('llm');
    });

    it('should handle cache invalidation failure', async () => {
      mockUpdateSettings.mockResolvedValue({ theme: 'light' });
      mockInvalidateNamespace.mockRejectedValue(new Error('Cache error'));

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { settings: { theme: 'light' } },
      });

      // Should still succeed (error is caught)
      expect(response.status).toBe(200);
      expect(mockInvalidateNamespace).toHaveBeenCalledWith('llm');
    });

    it('should handle combined settings and db_write_rules update', async () => {
      const updatedSettings = {
        theme: 'light',
        ops: { backupIntervalMin: 120 }
      };
      mockUpdateSettings.mockResolvedValue(updatedSettings);
      mockQuery.mockResolvedValue({ rows: [] });
      mockConfigureAutoBackup.mockResolvedValue(undefined);
      mockInvalidateNamespace.mockResolvedValue(undefined);

      const rules = [
        { table_name: 'users', allowed_ops: ['SELECT', 'UPDATE'] },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: {
          settings: { theme: 'light', ops: { backupIntervalMin: 120 } },
          db_write_rules: rules
        },
      });

      expect(response.status).toBe(200);
      // Check all operations were called
      expect(mockUpdateSettings).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        `delete from nofx.db_write_rule where tenant_id='local'`
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['users', ['SELECT', 'UPDATE'], {}]
      );
      expect(mockConfigureAutoBackup).toHaveBeenCalledWith(120);
      expect(mockInvalidateNamespace).toHaveBeenCalledWith('llm');
    });

    it('should handle null/undefined constraints in db_write_rules', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const rules = [
        { table_name: 'table1', allowed_ops: ['SELECT'], constraints: null },
        { table_name: 'table2', allowed_ops: ['INSERT'], constraints: undefined },
        { table_name: 'table3', allowed_ops: ['UPDATE'] }, // missing constraints
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      expect(response.status).toBe(200);
      // All should be inserted with empty object as constraints
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['table1', ['SELECT'], {}]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['table2', ['INSERT'], {}]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['table3', ['UPDATE'], {}]
      );
    });

    it('should handle special characters in table names', async () => {
      mockUpdateSettings.mockResolvedValue({});
      mockQuery.mockResolvedValue({ rows: [] });

      const rules = [
        { table_name: 'user-profiles', allowed_ops: ['SELECT'] },
        { table_name: 'posts_2024', allowed_ops: ['INSERT'] },
        { table_name: 'data.analytics', allowed_ops: ['SELECT'] },
      ];

      const response = await callHandler(settingsHandler, {
        method: 'POST',
        body: { db_write_rules: rules },
      });

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['user-profiles', ['SELECT'], {}]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['posts_2024', ['INSERT'], {}]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('insert into nofx.db_write_rule'),
        ['data.analytics', ['SELECT'], {}]
      );
    });

  });

  describe('Method validation', () => {
    it('should reject PUT requests', async () => {
      const response = await callHandler(settingsHandler, {
        method: 'PUT',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject DELETE requests', async () => {
      const response = await callHandler(settingsHandler, {
        method: 'DELETE',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject PATCH requests', async () => {
      const response = await callHandler(settingsHandler, {
        method: 'PATCH',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});