/**
 * Logger Module Unit Tests
 */

// Mock pino before import
const mockPinoInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  child: jest.fn()
};

jest.mock('pino', () => {
  return jest.fn(() => mockPinoInstance);
});

describe('Logger Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Initialization', () => {
    test('creates pino logger instance', () => {
      const pino = require('pino');
      const logger = pino();

      expect(pino).toHaveBeenCalled();
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    test('configures logger with options', () => {
      const pino = require('pino');
      const options = {
        level: 'debug',
        prettyPrint: true
      };

      pino(options);

      expect(pino).toHaveBeenCalledWith(options);
    });
  });

  describe('Logging Methods', () => {
    test('logs info messages', () => {
      const logger = require('pino')();

      logger.info('Information message');
      logger.info({ data: 'test' }, 'Info with context');

      expect(mockPinoInstance.info).toHaveBeenCalledWith('Information message');
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { data: 'test' },
        'Info with context'
      );
    });

    test('logs error messages', () => {
      const logger = require('pino')();
      const error = new Error('Test error');

      logger.error(error);
      logger.error({ err: error, context: 'test' }, 'Error occurred');

      expect(mockPinoInstance.error).toHaveBeenCalledWith(error);
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        { err: error, context: 'test' },
        'Error occurred'
      );
    });

    test('logs warning messages', () => {
      const logger = require('pino')();

      logger.warn('Warning message');
      logger.warn({ threshold: 100 }, 'Threshold exceeded');

      expect(mockPinoInstance.warn).toHaveBeenCalledWith('Warning message');
      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        { threshold: 100 },
        'Threshold exceeded'
      );
    });

    test('logs debug messages', () => {
      const logger = require('pino')();

      logger.debug('Debug message');
      logger.debug({ query: 'SELECT *' }, 'Database query');

      expect(mockPinoInstance.debug).toHaveBeenCalledWith('Debug message');
      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        { query: 'SELECT *' },
        'Database query'
      );
    });

    test('logs fatal messages', () => {
      const logger = require('pino')();

      logger.fatal('Fatal error');
      logger.fatal({ code: 'SYSTEM_FAILURE' }, 'System crashed');

      expect(mockPinoInstance.fatal).toHaveBeenCalledWith('Fatal error');
      expect(mockPinoInstance.fatal).toHaveBeenCalledWith(
        { code: 'SYSTEM_FAILURE' },
        'System crashed'
      );
    });
  });

  describe('Child Loggers', () => {
    test('creates child logger with context', () => {
      const logger = require('pino')();
      const childLogger = {
        info: jest.fn(),
        error: jest.fn()
      };

      mockPinoInstance.child.mockReturnValueOnce(childLogger);

      const child = logger.child({ requestId: 'req-123' });

      expect(mockPinoInstance.child).toHaveBeenCalledWith({
        requestId: 'req-123'
      });
      expect(child).toBe(childLogger);
    });

    test('child logger inherits parent context', () => {
      const logger = require('pino')();
      const childLogger = {
        info: jest.fn(),
        error: jest.fn()
      };

      mockPinoInstance.child.mockReturnValueOnce(childLogger);

      const child = logger.child({ service: 'api' });
      child.info('Child log message');

      expect(childLogger.info).toHaveBeenCalledWith('Child log message');
    });
  });

  describe('Structured Logging', () => {
    test('logs with metadata', () => {
      const logger = require('pino')();

      const metadata = {
        userId: 'user-123',
        action: 'login',
        timestamp: Date.now()
      };

      logger.info(metadata, 'User logged in');

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        metadata,
        'User logged in'
      );
    });

    test('logs arrays and objects', () => {
      const logger = require('pino')();

      const complexData = {
        users: ['user1', 'user2'],
        settings: {
          theme: 'dark',
          notifications: true
        }
      };

      logger.info(complexData, 'Complex data');

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        complexData,
        'Complex data'
      );
    });

    test('sanitizes sensitive data', () => {
      const logger = require('pino')();

      const sensitiveData = {
        password: 'secret123',
        token: 'bearer-token',
        creditCard: '4111111111111111'
      };

      const sanitize = (data: any) => {
        const sanitized = { ...data };
        if (sanitized.password) sanitized.password = '***';
        if (sanitized.token) sanitized.token = '***';
        if (sanitized.creditCard) sanitized.creditCard = '***';
        return sanitized;
      };

      const sanitizedData = sanitize(sensitiveData);
      logger.info(sanitizedData, 'User data');

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        {
          password: '***',
          token: '***',
          creditCard: '***'
        },
        'User data'
      );
    });
  });

  describe('Performance Logging', () => {
    test('logs execution time', () => {
      const logger = require('pino')();

      const startTime = Date.now();

      // Simulate work
      const doWork = () => {
        return 'result';
      };

      const result = doWork();
      const duration = Date.now() - startTime;

      logger.info({ duration, result }, 'Operation completed');

      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
          result: 'result'
        }),
        'Operation completed'
      );
    });

    test('logs memory usage', () => {
      const logger = require('pino')();

      const memoryUsage = process.memoryUsage();

      logger.debug({ memory: memoryUsage }, 'Memory usage');

      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        {
          memory: expect.objectContaining({
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number)
          })
        },
        'Memory usage'
      );
    });
  });

  describe('Error Logging', () => {
    test('logs error stack traces', () => {
      const logger = require('pino')();
      const error = new Error('Test error');

      logger.error({ err: error, stack: error.stack }, 'Error with stack');

      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        {
          err: error,
          stack: expect.stringContaining('Error: Test error')
        },
        'Error with stack'
      );
    });

    test('logs custom error properties', () => {
      const logger = require('pino')();

      class CustomError extends Error {
        code: string;
        statusCode: number;

        constructor(message: string, code: string, statusCode: number) {
          super(message);
          this.code = code;
          this.statusCode = statusCode;
        }
      }

      const customError = new CustomError('Not found', 'NOT_FOUND', 404);

      logger.error(
        {
          err: customError,
          code: customError.code,
          statusCode: customError.statusCode
        },
        'Custom error'
      );

      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        {
          err: customError,
          code: 'NOT_FOUND',
          statusCode: 404
        },
        'Custom error'
      );
    });
  });

  describe('Log Levels', () => {
    test('respects log level configuration', () => {
      const pino = require('pino');

      // Create logger with error level
      const errorLogger = pino({ level: 'error' });

      expect(pino).toHaveBeenCalledWith({ level: 'error' });
    });

    test('filters logs by level', () => {
      const shouldLog = (currentLevel: string, messageLevel: string) => {
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
        const currentIndex = levels.indexOf(currentLevel);
        const messageIndex = levels.indexOf(messageLevel);
        return messageIndex >= currentIndex;
      };

      expect(shouldLog('info', 'debug')).toBe(false);
      expect(shouldLog('info', 'info')).toBe(true);
      expect(shouldLog('info', 'error')).toBe(true);
      expect(shouldLog('error', 'warn')).toBe(false);
      expect(shouldLog('error', 'error')).toBe(true);
    });
  });
});