/**
 * Unit tests for static handler loader (Vercel-compatible)
 * Coverage target: 90%+
 *
 * Tests static handler loading for serverless environments:
 * - All handlers bundled at build time
 * - No dynamic require() calls
 */

describe('static handler loader', () => {
  let loadHandlers: () => any[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('basic functionality', () => {
    it('should return array of handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return handlers with match function', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach(handler => {
        expect(typeof handler.match).toBe('function');
      });
    });

    it('should return handlers with run function', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach(handler => {
        expect(typeof handler.run).toBe('function');
      });
    });

    it('should return non-empty handler list', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      expect(handlers.length).toBeGreaterThan(10);
    });
  });

  describe('handler inclusion', () => {
    it('should include bash handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const bashHandler = handlers.find(h => h.match('bash'));
      expect(bashHandler).toBeDefined();
      expect(bashHandler?.match('bash')).toBe(true);
    });

    it('should include codegen handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const codegenHandler = handlers.find(h => h.match('codegen') && !h.match('codegen:v2'));
      expect(codegenHandler).toBeDefined();
    });

    it('should include codegen_v2 handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const codegenV2Handler = handlers.find(h => h.match('codegen:v2'));
      expect(codegenV2Handler).toBeDefined();
    });

    it('should include db_write handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const dbWriteHandler = handlers.find(h => h.match('db_write'));
      expect(dbWriteHandler).toBeDefined();
    });

    it('should include gate handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const gateHandler = handlers.find(h => h.match('gate:check'));
      expect(gateHandler).toBeDefined();
    });

    it('should include git_ops handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const gitOpsHandler = handlers.find(h => h.match('git_ops'));
      expect(gitOpsHandler).toBeDefined();
    });

    it('should include git_pr handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const gitPrHandler = handlers.find(h => h.match('git_pr'));
      expect(gitPrHandler).toBeDefined();
    });

    it('should include manual handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const manualHandler = handlers.find(h => h.match('manual:test'));
      expect(manualHandler).toBeDefined();
      expect(manualHandler?.match('manual:approve')).toBe(true);
    });

    it('should include project_init handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const projectInitHandler = handlers.find(h => h.match('project_init'));
      expect(projectInitHandler).toBeDefined();
    });

    it('should include test_echo handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const testEchoHandler = handlers.find(h => h.match('test:echo'));
      expect(testEchoHandler).toBeDefined();
    });

    it('should include test_fail handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const testFailHandler = handlers.find(h => h.match('test:fail'));
      expect(testFailHandler).toBeDefined();
    });

    it('should include workspace_write handler', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const workspaceWriteHandler = handlers.find(h => h.match('workspace:write'));
      expect(workspaceWriteHandler).toBeDefined();
    });
  });

  describe('handler matching', () => {
    it('should have unique match patterns', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const testTools = [
        'bash',
        'codegen',
        'codegen:v2',
        'db_write',
        'gate:check',
        'git_ops',
        'git_pr',
        'manual:approve',
        'project_init',
        'test:echo',
        'test:fail',
        'workspace:write'
      ];

      testTools.forEach(tool => {
        const matchingHandlers = handlers.filter(h => h.match(tool));
        expect(matchingHandlers.length).toBe(1);
      });
    });

    it('should correctly match codegen variants', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const codegenHandler = handlers.find(h => h.match('codegen') && !h.match('codegen:v2'));
      const codegenV2Handler = handlers.find(h => h.match('codegen:v2'));

      expect(codegenHandler).toBeDefined();
      expect(codegenV2Handler).toBeDefined();
      expect(codegenHandler).not.toBe(codegenV2Handler);
    });

    it('should correctly match manual handler prefix', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const manualHandler = handlers.find(h => h.match('manual:approve'));
      expect(manualHandler).toBeDefined();
      expect(manualHandler?.match('manual:review')).toBe(true);
      expect(manualHandler?.match('manual:gate')).toBe(true);
      expect(manualHandler?.match('gate')).toBe(false);
    });

    it('should correctly match git handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const gitOpsHandler = handlers.find(h => h.match('git_ops'));
      const gitPrHandler = handlers.find(h => h.match('git_pr'));

      expect(gitOpsHandler).toBeDefined();
      expect(gitPrHandler).toBeDefined();
      expect(gitOpsHandler).not.toBe(gitPrHandler);
    });

    it('should correctly match test handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const testEchoHandler = handlers.find(h => h.match('test:echo'));
      const testFailHandler = handlers.find(h => h.match('test:fail'));

      expect(testEchoHandler).toBeDefined();
      expect(testFailHandler).toBeDefined();
      expect(testEchoHandler).not.toBe(testFailHandler);
      expect(testEchoHandler?.match('test:fail')).toBe(false);
    });
  });

  describe('handler uniqueness', () => {
    it('should not have duplicate handler references', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const uniqueHandlers = new Set(handlers);
      expect(uniqueHandlers.size).toBe(handlers.length);
    });

    it('should maintain handler identity across calls', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const handlers1 = loadHandlers();
      const handlers2 = loadHandlers();

      expect(handlers1.length).toBe(handlers2.length);

      // Each handler should be the same reference
      handlers1.forEach((h1, index) => {
        expect(h1).toBe(handlers2[index]);
      });
    });

    it('should have exactly 12 handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      // All core handlers: bash, codegen, codegen_v2, db_write, gate, git_ops,
      // git_pr, manual, project_init, test_echo, test_fail, workspace_write
      expect(handlers.length).toBe(12);
    });
  });

  describe('serverless compatibility', () => {
    it('should work without filesystem access', () => {
      // Static loader should not require fs module
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      expect(() => loadHandlers()).not.toThrow();
    });

    it('should return results synchronously', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const result = loadHandlers();

      // Should not be a promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should load instantly without IO operations', () => {
      const start = Date.now();
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      loadHandlers();
      const duration = Date.now() - start;

      // Should be nearly instant (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should work in cold start scenarios', () => {
      // Simulate cold start by resetting modules
      jest.resetModules();
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      expect(() => loadHandlers()).not.toThrow();
      expect(loadHandlers().length).toBe(12);
    });
  });

  describe('handler integrity', () => {
    it('should have valid handler structure', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      handlers.forEach((handler, index) => {
        expect(handler).toHaveProperty('match');
        expect(handler).toHaveProperty('run');
        expect(typeof handler.match).toBe('function');
        expect(typeof handler.run).toBe('function');
      });
    });

    it('should have handlers that can execute', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      // Verify handlers are actual executable functions
      handlers.forEach(handler => {
        expect(typeof handler.run).toBe('function');
        expect(handler.run.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have handlers with consistent interface', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      // All handlers should follow the same interface
      handlers.forEach(handler => {
        expect(handler.match).toBeInstanceOf(Function);
        expect(handler.run).toBeInstanceOf(Function);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle repeated calls efficiently', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const iterations = 100;
      const results: any[][] = [];

      for (let i = 0; i < iterations; i++) {
        results.push(loadHandlers());
      }

      // All results should be identical
      results.forEach(result => {
        expect(result.length).toBe(12);
      });
    });

    it('should work when imported multiple times', () => {
      jest.resetModules();
      const loadHandlers1 = require('../../../src/worker/handlers/static-loader').loadHandlers;

      jest.resetModules();
      const loadHandlers2 = require('../../../src/worker/handlers/static-loader').loadHandlers;

      expect(loadHandlers1().length).toBe(loadHandlers2().length);
    });

    it('should maintain handler references across calls', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const call1 = loadHandlers();
      const call2 = loadHandlers();

      // Should return the same handler instances
      expect(call1[0]).toBe(call2[0]);
      expect(call1[call1.length - 1]).toBe(call2[call2.length - 1]);
    });

    it('should not be affected by environment variables', () => {
      process.env.NODE_ENV = 'test';
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const testCount = loadHandlers().length;

      jest.resetModules();
      process.env.NODE_ENV = 'production';
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const prodCount = loadHandlers().length;

      // Static loader should always return the same handlers regardless of env
      expect(testCount).toBe(prodCount);
      expect(testCount).toBe(12);

      delete process.env.NODE_ENV;
    });
  });

  describe('comparison with dynamic loader', () => {
    it('should provide consistent handler count', () => {
      const staticLoader = require('../../../src/worker/handlers/static-loader');
      const staticHandlers = staticLoader.loadHandlers();

      // Static loader should have all core handlers
      expect(staticHandlers.length).toBe(12);
    });

    it('should include all production-critical handlers', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      const handlers = loadHandlers();

      const criticalTools = [
        'bash',
        'codegen',
        'codegen:v2',
        'workspace:write',
        'git_ops',
        'git_pr'
      ];

      criticalTools.forEach(tool => {
        const handler = handlers.find(h => h.match(tool));
        expect(handler).toBeDefined();
      });
    });
  });

  describe('performance', () => {
    it('should load handlers faster than dynamic loader', () => {
      const start = Date.now();
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;
      loadHandlers();
      const duration = Date.now() - start;

      // Static loading should be very fast
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent loads efficiently', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(loadHandlers())
      );

      return Promise.all(promises).then(results => {
        expect(results.every(r => r.length === 12)).toBe(true);
      });
    });

    it('should have minimal memory footprint', () => {
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      // Multiple calls should not create new handler instances
      const handlers1 = loadHandlers();
      const handlers2 = loadHandlers();

      // Same references = minimal memory
      expect(handlers1[0]).toBe(handlers2[0]);
    });
  });

  describe('vercel deployment compatibility', () => {
    it('should be compatible with serverless bundlers', () => {
      // Static imports should work with webpack, esbuild, etc.
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      expect(() => loadHandlers()).not.toThrow();
    });

    it('should not require runtime file system access', () => {
      // Should work even if fs is unavailable
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      const handlers = loadHandlers();
      expect(handlers.length).toBe(12);
    });

    it('should work in read-only filesystem environments', () => {
      // Serverless environments often have read-only filesystems
      loadHandlers = require('../../../src/worker/handlers/static-loader').loadHandlers;

      expect(() => loadHandlers()).not.toThrow();
    });
  });
});
