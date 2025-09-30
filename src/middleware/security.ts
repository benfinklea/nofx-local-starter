/**
 * Security middleware configuration
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction, Express } from 'express';
import { log } from '../lib/logger';

/**
 * Configure comprehensive security headers using Helmet
 */
export function configureSecurityHeaders(app: Express): void {
  // Basic Helmet configuration with strict security policies
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  }));

  // Additional security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Feature policy / Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Cache control for sensitive data
    if (_req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    next();
  });
}

/**
 * Global rate limiting middleware
 */
export function configureRateLimiting(app: Express): void {
  // Different rate limits for different endpoints
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const relaxedLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply strict rate limiting to auth endpoints
  app.use('/api/auth/login', strictLimiter);
  app.use('/api/auth/signup', strictLimiter);
  app.use('/api/auth/reset-password', strictLimiter);

  // Apply standard rate limiting to API endpoints
  app.use('/api/', standardLimiter);

  // Apply relaxed rate limiting to static assets
  app.use('/ui/static', relaxedLimiter);
}

/**
 * Request size limiting
 */
export function configureSizeLimits(app: Express): void {
  // Already configured in main.ts with express.json({ limit: "2mb" })
  // But we can add additional checks here

  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Request body exceeds maximum allowed size of 2MB'
      });
    }

    next();
  });
}

/**
 * SQL injection prevention middleware
 * This validates common query parameters
 */
export function preventSqlInjection(req: Request, res: Response, next: NextFunction): void | Response {
  const suspiciousPatterns = [
    /(\b)(DELETE|DROP|EXEC|EXECUTE|INSERT|SELECT|UNION|UPDATE)(\b)/gi,
    /(\-\-|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\'|\"|;|\\)/gi
  ];

  // Check query parameters
  for (const [key, value] of Object.entries(req.query)) {
    const strValue = String(value);
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(strValue)) {
        log.warn({
          ip: req.ip,
          path: req.path,
          query: req.query
        }, 'Potential SQL injection attempt blocked');

        return res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains invalid characters'
        });
      }
    }
  }

  // Check URL parameters
  for (const [key, value] of Object.entries(req.params)) {
    const strValue = String(value);
    // Allow UUIDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
      continue;
    }

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(strValue)) {
        log.warn({
          ip: req.ip,
          path: req.path,
          params: req.params
        }, 'Potential SQL injection attempt blocked');

        return res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains invalid characters'
        });
      }
    }
  }

  next();
}

/**
 * XSS prevention middleware
 * Sanitizes common inputs
 */
export function preventXss(req: Request, res: Response, next: NextFunction): void {
  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  // Recursive sanitization function
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      let sanitized = obj;
      for (const pattern of xssPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }
      return sanitized;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }

    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query) as any;
  }

  next();
}

/**
 * CSRF protection
 * Note: This is a basic implementation. Consider using csurf package for production
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void | Response {
  // Skip CSRF for GET requests and API calls with valid API keys
  if (req.method === 'GET' || req.headers['x-api-key']) {
    return next();
  }

  // Check for CSRF token in headers or body
  const token = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'This request requires a valid CSRF token'
    });
  }

  // In a real implementation, validate the token against session
  // For now, we'll just check it exists
  next();
}

/**
 * Apply all security middleware to the Express app
 */
export function applySecurity(app: Express): void {
  // Apply security headers
  configureSecurityHeaders(app);

  // Apply rate limiting
  configureRateLimiting(app);

  // Apply size limits
  configureSizeLimits(app);

  // Apply injection prevention
  app.use(preventSqlInjection);
  app.use(preventXss);

  // Log security middleware applied
  log.info('Security middleware configured successfully');
}