/**
 * Integration test setup
 * Configures the test environment for integration tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATA_DRIVER = 'fs';
process.env.QUEUE_DRIVER = 'memory';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities can be added here
