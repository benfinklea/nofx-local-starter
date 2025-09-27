/**
 * Resend Email Client for NOFX
 * Handles all email sending operations with retry logic
 */

import { Resend } from 'resend';
import { log } from '../logger';

// Initialize Resend client - use dummy key in test environment
const resend = new Resend(process.env.RESEND_API_KEY || (process.env.NODE_ENV === 'test' ? 're_test_key' : undefined));

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'NOFX <noreply@nofx-control-plane.com>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@nofx-control-plane.com',
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
}

/**
 * Send email with retry logic
 */
export async function sendEmail(options: EmailOptions): Promise<{ id: string; success: boolean; error?: string }> {
  // Validate API key
  if (!process.env.RESEND_API_KEY) {
    log.warn('RESEND_API_KEY not configured, skipping email send');
    return {
      id: 'mock-' + Date.now(),
      success: false,
      error: 'Email service not configured'
    };
  }

  const emailData = {
    from: options.from || EMAIL_CONFIG.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    react: options.react,
    reply_to: options.replyTo || EMAIL_CONFIG.replyTo,
    cc: options.cc,
    bcc: options.bcc,
    attachments: options.attachments,
    tags: options.tags,
  };

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 1; attempt <= EMAIL_CONFIG.maxRetries; attempt++) {
    try {
      log.info({
        to: options.to,
        subject: options.subject,
        attempt
      }, 'Sending email');

      const response = await resend.emails.send(emailData);

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
      log.error({
        error,
        attempt,
        to: options.to,
        subject: options.subject
      }, 'Failed to send email');

      if (attempt < EMAIL_CONFIG.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.retryDelay * attempt));
      }
    }
  }

  return {
    id: 'failed-' + Date.now(),
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
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
        <p>This is a test email from NOFX Control Plane.</p>
        <p>If you're seeing this, your email configuration is working correctly!</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Sent at ${new Date().toISOString()}
        </p>
      </div>
    `,
    text: 'This is a test email from NOFX Control Plane. Your email configuration is working!',
    tags: [{ name: 'type', value: 'test' }]
  });
}

export default resend;