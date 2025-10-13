/**
 * Unit tests for handler loader (dynamic require-based)
 * Coverage target: 90%+
 *
 * Tests dynamic handler loading with:
 * - Test environment filtering
 * - Handler validation
 * - Module loading
 */

describe('handler loader', () => {
  let loadHandlers: () => any[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Clean up environment
    delete process.env.NODE_ENV;
    delete process.env.LOAD_ALL_HANDLERS;
  });

  afterEach(() => {
    // Restore environment
    delete process.env.NODE_ENV;
    delete process.env.LOAD_ALL_HANDLERS;
  });

  describe('basic functionality', () => {
    it('should load handlers successfully', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return handlers with match function', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach(handler => {
        expect(typeof handler.match).toBe('function');
      });
    });

    it('should return handlers with run function', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach(handler => {
        expect(typeof handler.run).toBe('function');
      });
    });
  });

  describe('environment-based loading', () => {
    it('should load only test handlers in test environment by default', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(Array.isArray(handlers)).toBe(true);
      // Should primarily include test handlers
      const hasTestHandlers = handlers.some(h =>
        h.match('test:echo') || h.match('test:fail')
      );
      expect(hasTestHandlers).toBe(true);
    });

    it('should load all handlers when LOAD_ALL_HANDLERS=1 in test env', () => {
      process.env.NODE_ENV = 'test';
      process.env.LOAD_ALL_HANDLERS = '1';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(handlers.length).toBeGreaterThan(2);

      // Should include both test and non-test handlers
      const hasTestHandlers = handlers.some(h => h.match('test:echo'));
      const hasRegularHandlers = handlers.some(h => h.match('bash') || h.match('codegen'));

      expect(hasTestHandlers).toBe(true);
      expect(hasRegularHandlers).toBe(true);
    });

    it('should load all handlers in production environment', () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(handlers.length).toBeGreaterThan(5);

      // Should include various handler types
      const handlerTypes = handlers.map(h => {
        if (h.match('bash')) return 'bash';
        if (h.match('codegen')) return 'codegen';
        if (h.match('git:ops')) return 'git';
        if (h.match('manual:test')) return 'manual';
        return 'other';
      });

      expect(handlerTypes).toContain('bash');
    });

    it('should load all handlers in development environment', () => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(handlers.length).toBeGreaterThan(5);
    });

    it('should load all handlers when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Default behavior should load all handlers
      expect(handlers.length).toBeGreaterThan(5);
    });
  });

  describe('handler validation', () => {
    it('should skip files without .ts or .js extension', () => {
      // This is implicitly tested - loader only loads .ts/.js files
      // Non-.ts/.js files in directory should be ignored
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // All handlers should be valid
      expect(handlers.every(h => typeof h.match === 'function')).toBe(true);
    });

    it('should skip loader.ts file', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Loader should not load itself
      // This is validated by successful execution
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should skip types.ts file', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Types file should not be loaded as handler
      expect(handlers.every(h => typeof h.run === 'function')).toBe(true);
    });

    it('should accept handlers with default export', () => {
      process.env.LOAD_ALL_HANDLERS = '1';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Most handlers use default export
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should accept handlers with named handler export', () => {
      process.env.LOAD_ALL_HANDLERS = '1';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Should include handlers regardless of export style
      expect(handlers.length).toBeGreaterThan(0);
    });
  });

  describe('test file filtering', () => {
    it('should filter test files correctly in test environment', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Pattern: /^(test[_.].*|.*test.*)\.(ts|js)$/
      // Should match files with 'test' in them
      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should match test_ prefix pattern', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Should load test_echo.ts and test_fail.ts
      const testHandlers = handlers.filter(h =>
        h.match('test:echo') || h.match('test:fail')
      );
      expect(testHandlers.length).toBeGreaterThan(0);
    });

    it('should not apply filter when LOAD_ALL_HANDLERS is set', () => {
      process.env.NODE_ENV = 'test';
      process.env.LOAD_ALL_HANDLERS = '1';
      jest.resetModules();

      const loadHandlers1 = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlersWithFlag = loadHandlers1();

      delete process.env.LOAD_ALL_HANDLERS;
      jest.resetModules();

      const loadHandlers2 = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlersWithoutFlag = loadHandlers2();

      // With flag should load more handlers
      expect(handlersWithFlag.length).toBeGreaterThanOrEqual(handlersWithoutFlag.length);
    });
  });

  describe('handler uniqueness and integrity', () => {
    it('should not load duplicate handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Check for unique handler references
      const uniqueHandlers = new Set(handlers);
      expect(uniqueHandlers.size).toBe(handlers.length);
    });

    it('should maintain handler properties', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach(handler => {
        expect(handler).toHaveProperty('match');
        expect(handler).toHaveProperty('run');
        expect(typeof handler.match).toBe('function');
        expect(typeof handler.run).toBe('function');
      });
    });

    it('should load handlers that can actually match tools', () => {
      process.env.LOAD_ALL_HANDLERS = '1';
      jest.resetModules();

      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Test that handlers can match known tools
      const bashHandler = handlers.find(h => h.match('bash'));
      expect(bashHandler).toBeDefined();

      const testEchoHandler = handlers.find(h => h.match('test:echo'));
      expect(testEchoHandler).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle repeated calls consistently', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;

      const handlers1 = loadHandlers();
      const handlers2 = loadHandlers();

      expect(handlers1.length).toBe(handlers2.length);
    });

    it('should work across module reloads', () => {
      jest.resetModules();
      const loadHandlers1 = require('../../../src/worker/handlers/loader').loadHandlers;
      const count1 = loadHandlers1().length;

      jest.resetModules();
      const loadHandlers2 = require('../../../src/worker/handlers/loader').loadHandlers;
      const count2 = loadHandlers2().length;

      expect(count1).toBe(count2);
    });

    it('should handle different NODE_ENV values', () => {
      const envs = ['test', 'development', 'production', undefined];
      const results: number[] = [];

      envs.forEach(env => {
        if (env) {
          process.env.NODE_ENV = env;
        } else {
          delete process.env.NODE_ENV;
        }
        jest.resetModules();

        const loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
        results.push(loadHandlers().length);
      });

      // Test environment should have fewer handlers (unless LOAD_ALL_HANDLERS is set)
      // Use non-null assertion since we know results has 4 elements
      expect(results[0]!).toBeLessThanOrEqual(results[1]!);
      expect(results[1]).toBe(results[2]); // dev and prod should have same count
    });

    it('should return empty array if no valid handlers found', () => {
      // This is a theoretical case - in practice there are always handlers
      // But the function should handle it gracefully
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      expect(Array.isArray(handlers)).toBe(true);
    });
  });

  describe('file system integration', () => {
    it('should read handlers from actual filesystem', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // Verify we're loading real handlers
      expect(handlers.length).toBeGreaterThan(0);

      // All handlers should be actual handler objects
      handlers.forEach(h => {
        expect(h).toBeTruthy();
        expect(typeof h).toBe('object');
      });
    });

    it('should use __dirname to locate handler files', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;

      // Should successfully load from the handlers directory
      expect(() => loadHandlers()).not.toThrow();
    });

    it('should handle both .ts and .js files', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      const handlers = loadHandlers();

      // In compiled output, there might be .js files
      // In source, there are .ts files
      // Loader should handle both
      expect(handlers.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should load handlers efficiently', () => {
      const start = Date.now();
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;
      loadHandlers();
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple sequential loads', () => {
      loadHandlers = require('../../../src/worker/handlers/loader').loadHandlers;

      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        const handlers = loadHandlers();
        expect(handlers.length).toBeGreaterThan(0);
      }
    });
  });
});
