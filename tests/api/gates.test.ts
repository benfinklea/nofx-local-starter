import { callHandler, factories, resetMocks } from './utils/testHelpers';

// Clear any existing module mocks
jest.unmock('../../src/lib/store');
jest.unmock('../../src/lib/events');
jest.unmock('../../src/lib/auth');

// Mock store
const mockStore = {
  createOrGetGate: jest.fn(),
  listRuns: jest.fn(),
  listGatesByRun: jest.fn(),
  updateGate: jest.fn(),
};

const mockIsAdmin = jest.fn();
const mockRecordEvent = jest.fn();

// Mock dependencies
jest.mock('../../src/lib/store', () => ({
  store: mockStore,
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: mockRecordEvent,
}));

jest.mock('../../src/lib/auth', () => ({
  isAdmin: mockIsAdmin,
}));

// Import handlers after mocks
import gatesHandler from '../../api/gates/index';
import approveHandler from '../../api/gates/[id]/approve';
import waiveHandler from '../../api/gates/[id]/waive';

describe('Gates API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockIsAdmin.mockReset();
    mockRecordEvent.mockReset();
    // Default to authenticated
    mockIsAdmin.mockReturnValue(true);
    mockRecordEvent.mockResolvedValue(undefined);
  });

  describe('POST /api/gates', () => {
    it('should create a new gate', async () => {
      const mockGate = factories.gate();
      mockStore.createOrGetGate.mockResolvedValue(mockGate);

      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          run_id: 'run-123',
          step_id: 'step-456',
          gate_type: 'approval',
        },
      });

      expect(response.status).toBe(201);
      expect(response.json).toEqual(mockGate);
      expect(mockStore.createOrGetGate).toHaveBeenCalledWith(
        'run-123',
        'step-456',
        'approval'
      );
    });

    it('should handle missing run_id', async () => {
      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          step_id: 'step-456',
          gate_type: 'approval',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'run_id and gate_type required' });
    });

    it('should handle missing step_id', async () => {
      const mockGate = factories.gate();
      mockStore.createOrGetGate.mockResolvedValue(mockGate);

      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          run_id: 'run-123',
          gate_type: 'approval',
        },
      });

      // step_id is optional - empty string is used if not provided
      expect(response.status).toBe(201);
      expect(mockStore.createOrGetGate).toHaveBeenCalledWith('run-123', '', 'approval');
    });

    it('should handle missing gate_type', async () => {
      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          run_id: 'run-123',
          step_id: 'step-456',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'run_id and gate_type required' });
    });

    it('should handle creation errors', async () => {
      mockStore.createOrGetGate.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          run_id: 'run-123',
          step_id: 'step-456',
          gate_type: 'approval',
        },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions', async () => {
      mockStore.createOrGetGate.mockRejectedValue('String error');

      const response = await callHandler(gatesHandler, {
        method: 'POST',
        body: {
          run_id: 'run-123',
          step_id: 'step-456',
          gate_type: 'approval',
        },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to create gate' });
    });
  });

  describe('POST /api/gates/[id]/approve', () => {
    it('should approve a gate', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });
      const updatedGate = { ...mockGate, status: 'approved' };

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockResolvedValue(updatedGate);

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: {
          approved_by: 'user-123',
          reason: 'Looks good',
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(updatedGate);
      expect(mockStore.updateGate).toHaveBeenCalledWith('gate-123', {
        run_id: 'run-123',
        status: 'approved',
        approved_by: 'user-123',
        approved_at: expect.any(String),
      });
    });

    it('should handle missing approved_by', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });
      const updatedGate = { ...mockGate, status: 'approved' };

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockResolvedValue(updatedGate);

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: {},
      });

      expect(response.status).toBe(200);
      expect(mockStore.updateGate).toHaveBeenCalledWith('gate-123', {
        run_id: 'run-123',
        status: 'approved',
        approved_by: 'local-user',
        approved_at: expect.any(String),
      });
    });

    it('should handle gate not found', async () => {
      mockStore.listRuns.mockResolvedValue([factories.run()]);
      mockStore.listGatesByRun.mockResolvedValue([]);

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'non-existent' },
        body: {},
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'gate not found' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        authenticated: false,
      });


      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });

    it('should handle update errors', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockRejectedValue(new Error('Update failed'));

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: {},
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Update failed' });
    });

    it('should truncate long reason', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });
      const updatedGate = { ...mockGate, status: 'approved' };
      const longReason = 'x'.repeat(600);

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockResolvedValue(updatedGate);

      const response = await callHandler(approveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: { reason: longReason },
      });

      expect(response.status).toBe(200);
      // Reason should be truncated to 500 chars in recordEvent
      expect(mockRecordEvent).toHaveBeenCalledWith('run-123', 'gate.approved', {
        gateId: 'gate-123',
        approvedBy: 'local-user',
        reason: 'x'.repeat(500),
      });
    });
  });

  describe('POST /api/gates/[id]/waive', () => {
    it('should waive a gate', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });
      const updatedGate = { ...mockGate, status: 'waived' };

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockResolvedValue(updatedGate);

      const response = await callHandler(waiveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: {
          approved_by: 'user-123',
          reason: 'Not needed',
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(updatedGate);
      expect(mockStore.updateGate).toHaveBeenCalledWith('gate-123', {
        run_id: 'run-123',
        status: 'waived',
        approved_by: 'user-123',
        approved_at: expect.any(String),
      });
    });

    it('should handle gate not found', async () => {
      mockStore.listRuns.mockResolvedValue([factories.run()]);
      mockStore.listGatesByRun.mockResolvedValue([]);

      const response = await callHandler(waiveHandler, {
        method: 'POST',
        query: { id: 'non-existent' },
        body: {},
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'gate not found' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(waiveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        authenticated: false,
      });


      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'auth required', login: '/ui/login' });
    });

    it('should handle non-string reason', async () => {
      const mockRun = factories.run();
      const mockGate = factories.gate({ id: 'gate-123', run_id: 'run-123' });
      const updatedGate = { ...mockGate, status: 'waived' };

      mockStore.listRuns.mockResolvedValue([mockRun]);
      mockStore.listGatesByRun.mockResolvedValue([mockGate]);
      mockStore.updateGate.mockResolvedValue(updatedGate);

      const response = await callHandler(waiveHandler, {
        method: 'POST',
        query: { id: 'gate-123' },
        body: { reason: 123 },
      });

      expect(response.status).toBe(200);
      // Non-string reason should be ignored
      expect(mockRecordEvent).toHaveBeenCalledWith('run-123', 'gate.waived', {
        gateId: 'gate-123',
        approvedBy: 'local-user',
        reason: undefined,
      });
    });
  });

  describe('Method validation', () => {
    it('should reject GET requests to gates endpoint', async () => {
      const response = await callHandler(gatesHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET requests to approve endpoint', async () => {
      const response = await callHandler(approveHandler, {
        method: 'GET',
        query: { id: 'gate-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET requests to waive endpoint', async () => {
      const response = await callHandler(waiveHandler, {
        method: 'GET',
        query: { id: 'gate-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});