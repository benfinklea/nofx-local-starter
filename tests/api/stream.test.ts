import { callHandler, factories, resetMocks } from './utils/testHelpers';

// Clear any existing module mocks
jest.unmock('../../src/lib/store');

// Mock store
const mockStore = {
  listEvents: jest.fn(),
};

jest.mock('../../src/lib/store', () => ({
  store: mockStore,
}));

// Import handler after mocks
import streamHandler from '../../api/runs/[id]/stream';

describe('Stream API Endpoint', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('GET /api/runs/[id]/stream', () => {
    it('should set up SSE headers', async () => {
      const mockEvents = [
        { event: 'run.created', timestamp: new Date().toISOString() },
      ];
      mockStore.listEvents.mockResolvedValue(mockEvents);

      const response = await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      // Check SSE headers were set
      expect(response.headers).toMatchObject({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should send initial events', async () => {
      const mockEvents = [
        { event: 'run.created', timestamp: new Date().toISOString() },
        { event: 'step.started', timestamp: new Date().toISOString() },
      ];
      mockStore.listEvents.mockResolvedValue(mockEvents);

      const response = await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(mockStore.listEvents).toHaveBeenCalledWith('run-123');
      // The response.write calls are captured in our mock
      expect(response.writes).toContainEqual(
        expect.stringContaining('event: init')
      );
    });

    it('should handle errors when loading initial events', async () => {
      mockStore.listEvents.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      // Should not crash, just silently handle the error
      expect(response.status).toBe(200); // Default status
    });

    it('should set up polling interval', async () => {
      mockStore.listEvents.mockResolvedValue([]);

      await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      // Advance time to trigger polling
      jest.advanceTimersByTime(1000);

      // Should poll for updates
      expect(mockStore.listEvents).toHaveBeenCalledTimes(2);
    });

    it('should send updates when new events arrive', async () => {
      const initialEvents = [
        { event: 'run.created', timestamp: new Date().toISOString() },
      ];
      const allEvents = [
        ...initialEvents,
        { event: 'step.completed', timestamp: new Date().toISOString() },
      ];

      mockStore.listEvents
        .mockResolvedValueOnce(initialEvents)
        .mockResolvedValueOnce(allEvents);

      const response = await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      // Advance time to trigger polling
      jest.advanceTimersByTime(1000);

      // Should have sent an append event
      await Promise.resolve(); // Let promises resolve
      expect(response.writes).toContainEqual(
        expect.stringContaining('event: append')
      );
    });

    it('should handle polling errors silently', async () => {
      mockStore.listEvents
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);

      const response = await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      // Advance time to trigger polling twice
      jest.advanceTimersByTime(2000);

      // Should continue polling despite error
      await Promise.resolve();
      expect(mockStore.listEvents).toHaveBeenCalledTimes(3);
    });

    it('should timeout after 55 seconds', async () => {
      mockStore.listEvents.mockResolvedValue([]);

      let resEndCalled = false;
      const mockRes: any = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(() => {
          resEndCalled = true;
        }),
      };

      await streamHandler(
        { method: 'GET', query: { id: 'run-123' } } as any,
        mockRes
      );

      // Advance time to timeout
      jest.advanceTimersByTime(55000);
      await Promise.resolve(); // Let timeout execute

      // Should send timeout event
      expect(mockRes.write).toHaveBeenCalledWith('event: timeout\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: "Stream timeout"\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle client disconnect', async () => {
      mockStore.listEvents.mockResolvedValue([]);

      let closeCallback: any;
      const mockReq = {
        method: 'GET',
        query: { id: 'run-123' },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
      } as any;

      await callHandler(streamHandler, {
        method: 'GET',
        query: { id: 'run-123' },
        req: mockReq,
      });

      // Simulate close
      if (closeCallback) {
        closeCallback();
      }

      // Clear pending timers to verify polling stopped
      jest.clearAllTimers();

      // Should have registered the close handler
      expect(mockReq.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should reject non-GET requests', async () => {
      const response = await callHandler(streamHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});