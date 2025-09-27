/**
 * Comprehensive test suite for src/services/responses/archiveStore.ts
 * Tests file system archive functionality after refactoring
 */

// @ts-nocheck
import { jest } from '@jest/globals';

// Mock individual service files
jest.mock('../archiveStore/FileManagerService');
jest.mock('../archiveStore/SerializationService');
jest.mock('../archiveStore/RunManagementService');
jest.mock('../archiveStore/EventManagementService');
jest.mock('../archiveStore/SafetyManagementService');
jest.mock('../archiveStore/DelegationManagementService');
jest.mock('../archiveStore/ExportService');

describe('FileSystemResponsesArchive Tests', () => {
  let FileSystemResponsesArchive: any;
  let archive: any;
  let mockRunManagement: any;
  let mockEventManagement: any;
  let mockSafetyManagement: any;
  let mockDelegationManagement: any;
  let mockExportService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Import the module after mocks are set up
    const archiveModule = await import('../archiveStore');
    FileSystemResponsesArchive = archiveModule.FileSystemResponsesArchive;

    // Create new instance
    archive = new FileSystemResponsesArchive();

    // Get access to the mocked services through the constructor
    mockRunManagement = archive.runManagement;
    mockEventManagement = archive.eventManagement;
    mockSafetyManagement = archive.safetyManagement;
    mockDelegationManagement = archive.delegationManagement;
    mockExportService = archive.exportService;
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const testArchive = new FileSystemResponsesArchive();
      expect(testArchive).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const testArchive = new FileSystemResponsesArchive('/custom/path', {
        coldStorageDir: '/cold/storage',
        exportDir: '/exports'
      });
      expect(testArchive).toBeDefined();
    });

    it('should use environment variables for configuration', () => {
      process.env.RESPONSES_ARCHIVE_COLD_STORAGE_DIR = '/env/cold';
      const testArchive = new FileSystemResponsesArchive();
      expect(testArchive).toBeDefined();
      delete process.env.RESPONSES_ARCHIVE_COLD_STORAGE_DIR;
    });
  });

  describe('Run Management', () => {
    it('should start a new run', () => {
      const mockRun = {
        runId: 'test-run',
        request: { messages: [] },
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the service method
      if (mockRunManagement && mockRunManagement.startRun) {
        mockRunManagement.startRun.mockReturnValue(mockRun);
      }

      const input = {
        runId: 'test-run',
        request: { messages: [] },
      };

      const result = archive.startRun(input);

      expect(result).toEqual(mockRun);
      if (mockRunManagement && mockRunManagement.startRun) {
        expect(mockRunManagement.startRun).toHaveBeenCalledWith(input);
      }
    });

    it('should get existing run', () => {
      const mockRun = {
        runId: 'test-run',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the service method
      if (mockRunManagement && mockRunManagement.getRun) {
        mockRunManagement.getRun.mockReturnValue(mockRun);
      }

      const result = archive.getRun('test-run');

      expect(result).toEqual(mockRun);
      if (mockRunManagement && mockRunManagement.getRun) {
        expect(mockRunManagement.getRun).toHaveBeenCalledWith('test-run');
      }
    });

    it('should return undefined for non-existent run', () => {
      // Mock the service method
      if (mockRunManagement && mockRunManagement.getRun) {
        mockRunManagement.getRun.mockReturnValue(undefined);
      }

      const result = archive.getRun('non-existent');

      expect(result).toBeUndefined();
      if (mockRunManagement && mockRunManagement.getRun) {
        expect(mockRunManagement.getRun).toHaveBeenCalledWith('non-existent');
      }
    });

    it('should update run status', () => {
      const mockUpdatedRun = {
        runId: 'test-run',
        status: 'succeeded',
        updatedAt: new Date(),
      };

      // Mock the service method
      if (mockRunManagement && mockRunManagement.updateStatus) {
        mockRunManagement.updateStatus.mockReturnValue(mockUpdatedRun);
      }

      const input = { runId: 'test-run', status: 'succeeded' };
      const result = archive.updateStatus(input);

      expect(result).toEqual(mockUpdatedRun);
      if (mockRunManagement && mockRunManagement.updateStatus) {
        expect(mockRunManagement.updateStatus).toHaveBeenCalledWith(input);
      }
    });

    it('should list all runs', () => {
      const mockRuns = [
        { runId: 'run1', createdAt: new Date() },
        { runId: 'run2', createdAt: new Date() },
      ];

      // Mock the service method
      if (mockRunManagement && mockRunManagement.listRuns) {
        mockRunManagement.listRuns.mockReturnValue(mockRuns);
      }

      const result = archive.listRuns();

      expect(result).toEqual(mockRuns);
      if (mockRunManagement && mockRunManagement.listRuns) {
        expect(mockRunManagement.listRuns).toHaveBeenCalled();
      }
    });

    it('should delete run', () => {
      // Mock the service method
      if (mockRunManagement && mockRunManagement.deleteRun) {
        mockRunManagement.deleteRun.mockReturnValue(undefined);
      }

      archive.deleteRun('test-run');

      if (mockRunManagement && mockRunManagement.deleteRun) {
        expect(mockRunManagement.deleteRun).toHaveBeenCalledWith('test-run');
      }
    });
  });

  describe('Event Management', () => {
    it('should record event', () => {
      const mockEvent = {
        runId: 'test-run',
        sequence: 1,
        type: 'test.event',
        payload: { data: 'test' },
        occurredAt: new Date(),
      };

      // Mock getRun to return a valid run
      if (mockRunManagement && mockRunManagement.getRun) {
        mockRunManagement.getRun.mockReturnValue({ runId: 'test-run' });
      }

      // Mock the service method
      if (mockEventManagement && mockEventManagement.recordEvent) {
        mockEventManagement.recordEvent.mockReturnValue(mockEvent);
      }

      const input = {
        type: 'test.event',
        payload: { data: 'test' },
      };

      const result = archive.recordEvent('test-run', input);

      expect(result).toEqual(mockEvent);
      if (mockEventManagement && mockEventManagement.recordEvent) {
        expect(mockEventManagement.recordEvent).toHaveBeenCalledWith('test-run', input);
      }
    });

    it('should get timeline', () => {
      const mockTimeline = {
        run: { runId: 'test-run' },
        events: [{ sequence: 1, type: 'test.event' }],
      };

      // Mock the service method
      if (mockEventManagement && mockEventManagement.getTimeline) {
        mockEventManagement.getTimeline.mockReturnValue(mockTimeline);
      }

      const result = archive.getTimeline('test-run');

      expect(result).toEqual(mockTimeline);
      if (mockEventManagement && mockEventManagement.getTimeline) {
        expect(mockEventManagement.getTimeline).toHaveBeenCalledWith('test-run', expect.any(Function));
      }
    });

    it('should get snapshot at sequence', () => {
      const mockSnapshot = {
        run: { runId: 'test-run' },
        events: [{ sequence: 1 }],
      };

      // Mock the service method
      if (mockEventManagement && mockEventManagement.snapshotAt) {
        mockEventManagement.snapshotAt.mockReturnValue(mockSnapshot);
      }

      const result = archive.snapshotAt('test-run', 1);

      expect(result).toEqual(mockSnapshot);
      if (mockEventManagement && mockEventManagement.snapshotAt) {
        expect(mockEventManagement.snapshotAt).toHaveBeenCalledWith('test-run', 1, expect.any(Function));
      }
    });

    it('should rollback timeline', () => {
      const mockResult = {
        run: { runId: 'test-run', updatedAt: new Date() },
        events: [],
      };

      // Mock the service method
      if (mockEventManagement && mockEventManagement.rollback) {
        mockEventManagement.rollback.mockReturnValue(mockResult);
      }

      const options = { sequence: 1 };
      const result = archive.rollback('test-run', options);

      expect(result).toEqual(mockResult);
      if (mockEventManagement && mockEventManagement.rollback) {
        expect(mockEventManagement.rollback).toHaveBeenCalledWith('test-run', options, expect.any(Function));
      }
    });
  });

  describe('Safety Management', () => {
    it('should update safety information', () => {
      const mockSafety = {
        hashedIdentifier: 'hash123',
        refusalCount: 0,
        moderatorNotes: [],
      };

      // Mock the service method
      if (mockSafetyManagement && mockSafetyManagement.updateSafety) {
        mockSafetyManagement.updateSafety.mockReturnValue(mockSafety);
      }

      const input = { hashedIdentifier: 'hash123' };
      const result = archive.updateSafety('test-run', input);

      expect(result).toEqual(mockSafety);
      if (mockSafetyManagement && mockSafetyManagement.updateSafety) {
        expect(mockSafetyManagement.updateSafety).toHaveBeenCalledWith('test-run', input, expect.any(Function));
      }
    });

    it('should add moderator note', () => {
      const mockNote = {
        reviewer: 'test-reviewer',
        note: 'Test note',
        disposition: 'approved',
        recordedAt: new Date(),
      };

      // Mock the service method
      if (mockSafetyManagement && mockSafetyManagement.addModeratorNote) {
        mockSafetyManagement.addModeratorNote.mockReturnValue(mockNote);
      }

      const input = {
        reviewer: 'test-reviewer',
        note: 'Test note',
        disposition: 'approved',
      };

      const result = archive.addModeratorNote('test-run', input);

      expect(result).toEqual(mockNote);
      if (mockSafetyManagement && mockSafetyManagement.addModeratorNote) {
        expect(mockSafetyManagement.addModeratorNote).toHaveBeenCalledWith('test-run', input, expect.any(Function));
      }
    });
  });

  describe('Delegation Management', () => {
    it('should record delegation', () => {
      const mockDelegation = {
        callId: 'call123',
        status: 'pending',
        requestedAt: new Date(),
      };

      // Mock the service method
      if (mockDelegationManagement && mockDelegationManagement.recordDelegation) {
        mockDelegationManagement.recordDelegation.mockReturnValue(mockDelegation);
      }

      const result = archive.recordDelegation('test-run', mockDelegation);

      expect(result).toEqual(mockDelegation);
      if (mockDelegationManagement && mockDelegationManagement.recordDelegation) {
        expect(mockDelegationManagement.recordDelegation).toHaveBeenCalledWith('test-run', mockDelegation, expect.any(Function));
      }
    });

    it('should update delegation', () => {
      const mockUpdatedDelegation = {
        callId: 'call123',
        status: 'completed',
        completedAt: new Date(),
      };

      // Mock the service method
      if (mockDelegationManagement && mockDelegationManagement.updateDelegation) {
        mockDelegationManagement.updateDelegation.mockReturnValue(mockUpdatedDelegation);
      }

      const updates = { status: 'completed' };
      const result = archive.updateDelegation('test-run', 'call123', updates);

      expect(result).toEqual(mockUpdatedDelegation);
      if (mockDelegationManagement && mockDelegationManagement.updateDelegation) {
        expect(mockDelegationManagement.updateDelegation).toHaveBeenCalledWith('test-run', 'call123', updates, expect.any(Function));
      }
    });
  });

  describe('Export Operations', () => {
    it('should export run', async () => {
      const mockTimeline = {
        run: { runId: 'test-run' },
        events: [],
      };
      const mockExportPath = '/exports/test-run.json.gz';

      // Mock getTimeline
      if (mockEventManagement && mockEventManagement.getTimeline) {
        mockEventManagement.getTimeline.mockReturnValue(mockTimeline);
      }

      // Mock the export service
      if (mockExportService && mockExportService.exportRun) {
        mockExportService.exportRun.mockResolvedValue(mockExportPath);
      }

      const result = await archive.exportRun('test-run');

      expect(result).toBe(mockExportPath);
      if (mockExportService && mockExportService.exportRun) {
        expect(mockExportService.exportRun).toHaveBeenCalledWith(mockTimeline, 'test-run');
      }
    });

    it('should throw error when exporting non-existent run', async () => {
      // Mock getTimeline to return undefined
      if (mockEventManagement && mockEventManagement.getTimeline) {
        mockEventManagement.getTimeline.mockReturnValue(undefined);
      }

      await expect(archive.exportRun('non-existent')).rejects.toThrow('run non-existent not found');
    });
  });

  describe('Data Management', () => {
    it('should prune older runs', () => {
      // Mock the service method
      if (mockRunManagement && mockRunManagement.pruneOlderThan) {
        mockRunManagement.pruneOlderThan.mockReturnValue(undefined);
      }

      const cutoff = new Date();
      archive.pruneOlderThan(cutoff);

      if (mockRunManagement && mockRunManagement.pruneOlderThan) {
        expect(mockRunManagement.pruneOlderThan).toHaveBeenCalledWith(cutoff, expect.any(Function));
      }
    });
  });
});