/**
 * Resend Email Client for NOFX
 * Handles all email sending operations with retry logic
 */

import { Resend } from 'resend';
import { log } from '../logger';

// Lazy initialization of Resend client for better testability
let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY || (process.env.NODE_ENV === 'test' ? 're_test_key' : undefined));
  }
  return resendInstance;
}

// Export for testing - allows tests to reset the client instance
export function resetResendClient(): void {
  resendInstance = null;
}

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'NOFX <noreply@nofx-local-starter.com>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@nofx-local-starter.com',
  defaultSubject: 'NOFX Control Plane',
  maxRetries: 3,
  retryDelay: 1000, // ms
};

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
  tags?: Array<{
    name: string;
    value: string;
  }>;
  headers?: Record<string, string>;
}

/**
 * Send email with retry logic
 */
export async function sendEmail(options: EmailOptions): Promise<{ id: string; success: boolean; error?: string }> {
  // Validate email address
  const toEmails = Array.isArray(options.to) ? options.to : [options.to];
  for (const email of toEmails) {
    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address');
      return {
        id: '',
        success: false,
        error: `Invalid email address: ${email}`
      };
    }
  }

  // Validate subject
  if (!options.subject || options.subject.trim().length === 0) {
    log.error('Empty subject');
    return {
      id: '',
      success: false,
      error: 'Email subject is required'
    };
  }

  // Validate content
  if (!options.html && !options.text && !options.react) {
    log.error('Missing email content');
    return {
      id: '',
      success: false,
      error: 'Email content (html, text, or react) is required'
    };
  }

  // Sanitize subject - remove CRLF injection attempts and any header-like content
  let sanitizedSubject = options.subject.replace(/[\r\n\t]/g, '');
  // Remove anything that looks like an email header injection (header name followed by colon)
  // This needs to handle cases like "Test\r\nBcc:" or mid-string injections
  sanitizedSubject = sanitizedSubject.replace(/(Bcc|Cc|To|From|Subject|X-[\w-]+):\s*/gi, '');

  // Validate API key
  if (!process.env.RESEND_API_KEY) {
    log.warn('RESEND_API_KEY not configured, skipping email send');
    return {
      id: 'mock-' + Date.now(),
      success: false,
      error: 'Email service not configured - API key required'
    };
  }

  // Merge headers with default X-Entity-Ref-ID
  const headers = {
    'X-Entity-Ref-ID': `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...options.headers
  };

  // Sanitize template injection in subject and html
  const finalSubject = sanitizedSubject.replace(/\{\{[^}]*\}\}/g, '');
  const finalHtml = options.html ? options.html.replace(/\{\{[^}]*\}\}/g, '') : undefined;

  const emailData = {
    from: options.from || process.env.EMAIL_FROM || EMAIL_CONFIG.from,
    to: options.to,
    subject: finalSubject,
    html: finalHtml,
    text: options.text,
    react: options.react,
    reply_to: options.replyTo || process.env.EMAIL_REPLY_TO || EMAIL_CONFIG.replyTo,
    cc: options.cc,
    bcc: options.bcc,
    attachments: options.attachments,
    tags: options.tags,
    headers
  };

  let lastError: Error | null = null;

  // Retry logic with permanent failure detection
  for (let attempt = 1; attempt <= EMAIL_CONFIG.maxRetries; attempt++) {
    try {
      log.info({
        to: options.to,
        subject: options.subject,
        attempt
      }, 'Sending email');

      const response = await getResendClient().emails.send(emailData);

      if (response.error) {
        throw new Error(response.error.message);
      }

      log.info({
        emailId: response.data?.id,
        to: options.to,
        subject: options.subject
      }, 'Email sent successfully');

      return {
        id: response.data?.id || 'unknown',
        success: true
      };
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();

      log.error({
        error,
        attempt,
        to: options.to,
        subject: options.subject
      }, 'Failed to send email');

      // Check if this is a permanent failure (don't retry)
      // Temporary failures: rate limit, timeout, network errors, temporary errors
      // Permanent failures: authentication, validation, forbidden access
      const isTemporaryFailure =
        errorMessage.includes('rate limit') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('temporary') ||
        errorMessage.includes('network');

      const isPermanentFailure = !isTemporaryFailure && (
        errorMessage.includes('invalid email') ||
        errorMessage.includes('invalid api key') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('failed') // Generic failure - don't retry
      );

      if (isPermanentFailure || attempt >= EMAIL_CONFIG.maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.retryDelay * attempt));
    }
  }

  return {
    id: '',
    success: false,
    error: lastError?.message || 'Failed to send email after retries'
  };
}

/**
 * Send batch emails
 */
export async function sendBatchEmails(
  emails: EmailOptions[]
): Promise<Array<{ id: string; success: boolean; error?: string }>> {
  const results = [];

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(email => sendEmail(email))
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Validate email address with comprehensive checks
 */
export function isValidEmail(email: string | null | undefined): boolean {
  // Check for null/undefined/empty
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Trim whitespace
  email = email.trim();

  // Check length constraints (RFC 5321)
  if (email.length === 0 || email.length > 320) {
    return false;
  }

  // Check for basic structure and invalid characters
  if (email.includes(' ') || email.includes('\n') || email.includes('\r') || email.includes('\t')) {
    return false;
  }

  // Security: Check for email header injection attempts
  if (email.includes('%0A') || email.includes('%0D') || email.includes(';')) {
    return false;
  }

  // Security: Check for script tags and HTML injection
  if (email.includes('<') || email.includes('>') || email.includes('"') || email.includes("'")) {
    return false;
  }

  // Split into local and domain parts
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domainPart] = parts;

  // Validate local part (before @)
  if (!localPart || localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Check for invalid dot placement in local part
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  // Validate domain part (after @)
  if (!domainPart || domainPart.length === 0 || domainPart.length > 255) {
    return false;
  }

  // Check for invalid dot placement in domain
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false;
  }

  // Domain must contain at least one dot
  if (!domainPart.includes('.')) {
    return false;
  }

  // Basic character validation for local part (alphanumeric, dots, hyphens, underscores, plus signs)
  const localPartRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localPartRegex.test(localPart)) {
    return false;
  }

  // Basic character validation for domain part (alphanumeric, dots, hyphens)
  // Note: This is a simplified check - doesn't support internationalized domains
  const domainPartRegex = /^[a-zA-Z0-9.-]+$/;
  if (!domainPartRegex.test(domainPart)) {
    return false;
  }

  // Validate domain labels (parts between dots)
  const domainLabels = domainPart.split('.');
  for (const label of domainLabels) {
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    // Labels can't start or end with hyphens
    if (label.startsWith('-') || label.endsWith('-')) {
      return false;
    }
  }

  // TLD (last part of domain) should be at least 2 characters
  const tld = domainLabels[domainLabels.length - 1];
  if (tld.length < 2) {
    return false;
  }

  return true;
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: 'NOFX Email Test',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Email Configuration Test</h1>
        <p>Email system is working correctly!</p>
        <p>This is a test email from NOFX Control Plane.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          <strong>Test timestamp:</strong> ${new Date().toISOString()}<br>
          <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}
        </p>
      </div>
    `,
    text: 'Email system is working! This is a test email from NOFX Control Plane. Your email configuration is working correctly!',
    tags: [{ name: 'type', value: 'test' }]
  });
}

export default getResendClient();