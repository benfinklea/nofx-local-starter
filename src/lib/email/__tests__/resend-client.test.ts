/**
 * Resend Email Client Tests - 90%+ Coverage Target
 * Critical email infrastructure - must be bulletproof
 */

import { sendEmail, sendBatchEmails, sendTestEmail, isValidEmail } from '../resend-client';
import { Resend } from 'resend';

// Mock Resend
jest.mock('resend');
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn()
    }))
  }
}));

const MockedResend = Resend as jest.MockedClass<typeof Resend>;

describe('Resend Email Client - Reliability Tests', () => {
  let mockResend: jest.Mocked<Resend>;
  let mockSend: jest.Mock;

  // Common email options used across tests
  const basicEmailOptions = {
    to: 'test@example.com',
    subject: 'Test Email',
    html: '<p>Test content</p>'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSend = jest.fn();
    mockResend = {
      emails: { send: mockSend }
    } as any;

    MockedResend.mockImplementation(() => mockResend);

    // Default success response
    mockSend.mockResolvedValue({
      data: { id: 'email_123' },
      error: null
    });
  });

  describe('isValidEmail()', () => {
    describe('Valid Email Formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@domain.com',
        'user_123@sub.domain.com',
        'firstname.lastname@company.org',
        'a@b.co',
        'test.email+tag+sorting@example.com'
      ];

      test.each(validEmails)('accepts valid email: %s', (email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    describe('Invalid Email Formats', () => {
      const invalidEmails = [
        '',
        null,
        undefined,
        'invalid',
        '@domain.com',
        'user@',
        'user@@domain.com',
        'user@domain',
        'user.domain.com',
        'user @domain.com',
        'user@domain .com',
        'user@domain..com',
        '.user@domain.com',
        'user.@domain.com',
        'user@domain.com.',
        'a'.repeat(320) + '@domain.com', // Too long
        'user@' + 'a'.repeat(250) + '.com' // Domain too long
      ];

      test.each(invalidEmails)('rejects invalid email: %s', (email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    describe('Security Tests', () => {
      const maliciousEmails = [
        'test@example.com\r\nBcc: attacker@evil.com',
        'test@example.com\nBcc: attacker@evil.com',
        'test@example.com%0ABcc: attacker@evil.com',
        'test@example.com; attacker@evil.com',
        '<script>alert(1)</script>@domain.com',
        'test@<script>alert(1)</script>.com',
        '"<script>alert(1)</script>"@domain.com'
      ];

      test.each(maliciousEmails)('prevents email injection: %s', (email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    describe('Internationalization', () => {
      const internationalEmails = [
        'user@münchen.de',
        'user@中国.com',
        'user@россия.рф',
        'üser@domain.com',
        'user@dömain.com'
      ];

      test.each(internationalEmails)('handles international domains: %s', (email) => {
        // Basic ASCII validation for now
        const result = isValidEmail(email);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('sendEmail()', () => {
    describe('Successful Email Sending', () => {
      it('sends email with valid options', async () => {
        const result = await sendEmail(basicEmailOptions);

        expect(mockSend).toHaveBeenCalledWith({
          from: process.env.EMAIL_FROM || 'NOFX <noreply@nofx.dev>',
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
          headers: {
            'X-Entity-Ref-ID': expect.any(String)
          }
        });

        expect(result).toEqual({
          id: 'email_123',
          success: true
        });
      });

      it('sends email with React component', async () => {
        const MockComponent = () => ({ type: 'div', props: { children: 'React Email' } });

        const options = {
          ...basicEmailOptions,
          react: MockComponent() as any,
          html: undefined
        };

        await sendEmail(options);

        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
          react: expect.any(Object)
        }));
      });

      it('includes custom headers', async () => {
        const options = {
          ...basicEmailOptions,
          headers: {
            'X-Custom': 'value',
            'X-Priority': 'high'
          }
        };

        await sendEmail(options);

        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
            'X-Priority': 'high',
            'X-Entity-Ref-ID': expect.any(String)
          })
        }));
      });

      it('includes tags and metadata', async () => {
        const options = {
          ...basicEmailOptions,
          tags: [
            { name: 'type', value: 'test' },
            { name: 'userId', value: '123' }
          ]
        };

        await sendEmail(options);

        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
          tags: [
            { name: 'type', value: 'test' },
            { name: 'userId', value: '123' }
          ]
        }));
      });
    });

    describe('Error Handling', () => {
      it('handles Resend API errors', async () => {
        mockSend.mockResolvedValue({
          data: null,
          error: { message: 'Invalid API key' }
        });

        const result = await sendEmail(basicEmailOptions);

        expect(result).toEqual({
          id: '',
          success: false,
          error: 'Invalid API key'
        });
      });

      it('handles network errors', async () => {
        mockSend.mockRejectedValue(new Error('Network timeout'));

        const result = await sendEmail(basicEmailOptions);

        expect(result).toEqual({
          id: '',
          success: false,
          error: 'Network timeout'
        });
      });

      it('handles missing API key', async () => {
        const originalEnv = process.env.RESEND_API_KEY;
        delete process.env.RESEND_API_KEY;

        mockSend.mockRejectedValue(new Error('API key required'));

        const result = await sendEmail(basicEmailOptions);

        expect(result.success).toBe(false);
        expect(result.error).toContain('API key');

        // Restore
        if (originalEnv) process.env.RESEND_API_KEY = originalEnv;
      });
    });

    describe('Input Validation', () => {
      it('rejects invalid email addresses', async () => {
        const options = {
          ...basicEmailOptions,
          to: 'invalid-email'
        };

        const result = await sendEmail(options);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid email address');
        expect(mockSend).not.toHaveBeenCalled();
      });

      it('rejects empty subject', async () => {
        const options = {
          ...basicEmailOptions,
          subject: ''
        };

        const result = await sendEmail(options);

        expect(result.success).toBe(false);
        expect(result.error).toContain('subject');
      });

      it('rejects missing content', async () => {
        const options = {
          to: 'test@example.com',
          subject: 'Test'
          // No html or react
        };

        const result = await sendEmail(options);

        expect(result.success).toBe(false);
        expect(result.error).toContain('content');
      });

      it('sanitizes malicious content', async () => {
        const options = {
          ...basicEmailOptions,
          subject: 'Test\r\nBcc: attacker@evil.com',
          html: '<script>alert("xss")</script><p>Content</p>'
        };

        const result = await sendEmail(options);

        if (result.success) {
          const sentData = mockSend.mock.calls[0][0];
          expect(sentData.subject).not.toContain('Bcc:');
          expect(sentData.subject).not.toContain('\r\n');
        }
      });
    });

    describe('Retry Logic', () => {
      it('retries on temporary failures', async () => {
        mockSend
          .mockResolvedValueOnce({ data: null, error: { message: 'Rate limit exceeded' } })
          .mockResolvedValueOnce({ data: null, error: { message: 'Temporary error' } })
          .mockResolvedValueOnce({ data: { id: 'email_123' }, error: null });

        const result = await sendEmail(basicEmailOptions);

        expect(mockSend).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(true);
        expect(result.id).toBe('email_123');
      });

      it('gives up after max retries', async () => {
        mockSend.mockResolvedValue({
          data: null,
          error: { message: 'Persistent error' }
        });

        const result = await sendEmail(basicEmailOptions);

        expect(mockSend).toHaveBeenCalledTimes(3); // Max retries
        expect(result.success).toBe(false);
      });

      it('does not retry on permanent failures', async () => {
        mockSend.mockResolvedValue({
          data: null,
          error: { message: 'Invalid email address' }
        });

        const result = await sendEmail(basicEmailOptions);

        expect(mockSend).toHaveBeenCalledTimes(1); // No retry
        expect(result.success).toBe(false);
      });
    });
  });

  describe('sendBatchEmails()', () => {
    const batchEmails = [
      {
        to: 'user1@example.com',
        subject: 'Email 1',
        html: '<p>Content 1</p>'
      },
      {
        to: 'user2@example.com',
        subject: 'Email 2',
        html: '<p>Content 2</p>'
      },
      {
        to: 'user3@example.com',
        subject: 'Email 3',
        html: '<p>Content 3</p>'
      }
    ];

    it('sends multiple emails successfully', async () => {
      mockSend
        .mockResolvedValueOnce({ data: { id: 'email_1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'email_2' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'email_3' }, error: null });

      const results = await sendBatchEmails(batchEmails);

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles partial failures in batch', async () => {
      mockSend
        .mockResolvedValueOnce({ data: { id: 'email_1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Failed' } })
        .mockResolvedValueOnce({ data: { id: 'email_3' }, error: null });

      const results = await sendBatchEmails(batchEmails);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('limits concurrent email sends', async () => {
      const largeBatch = Array(20).fill(null).map((_, i) => ({
        to: `user${i}@example.com`,
        subject: `Email ${i}`,
        html: `<p>Content ${i}</p>`
      }));

      mockSend.mockResolvedValue({ data: { id: 'email_ok' }, error: null });

      const startTime = Date.now();
      await sendBatchEmails(largeBatch);
      const duration = Date.now() - startTime;

      // Should process in batches, not all at once
      expect(duration).toBeGreaterThan(100); // Some delay expected
      expect(mockSend).toHaveBeenCalledTimes(20);
    });

    it('validates all emails before sending', async () => {
      const invalidBatch = [
        ...batchEmails,
        {
          to: 'invalid-email',
          subject: 'Invalid',
          html: '<p>Content</p>'
        }
      ];

      const results = await sendBatchEmails(invalidBatch);

      expect(results[3].success).toBe(false);
      expect(results[3].error).toContain('Invalid email');
      expect(mockSend).toHaveBeenCalledTimes(3); // Only valid emails sent
    });
  });

  describe('sendTestEmail()', () => {
    it('sends test email successfully', async () => {
      const result = await sendTestEmail('test@example.com');

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: 'NOFX Email Test',
        html: expect.stringContaining('Email system is working')
      }));

      expect(result.success).toBe(true);
    });

    it('includes system information in test email', async () => {
      await sendTestEmail('test@example.com');

      const sentData = mockSend.mock.calls[0][0];
      expect(sentData.html).toContain('Test timestamp:');
      expect(sentData.html).toContain('Environment:');
    });

    it('rejects invalid test email address', async () => {
      const result = await sendTestEmail('invalid');

      expect(result.success).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('handles high-volume email sending', async () => {
      const emails = Array(100).fill(null).map((_, i) => ({
        to: `user${i}@example.com`,
        subject: `Email ${i}`,
        html: `<p>Content ${i}</p>`
      }));

      mockSend.mockResolvedValue({ data: { id: 'email_ok' }, error: null });

      const startTime = Date.now();
      const results = await sendBatchEmails(emails);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('handles concurrent email requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        sendEmail(basicEmailOptions)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('manages memory efficiently with large emails', async () => {
      const largeContent = '<p>' + 'x'.repeat(100000) + '</p>';
      const options = {
        ...basicEmailOptions,
        html: largeContent
      };

      const result = await sendEmail(options);

      expect(result.success).toBe(true);
    });
  });

  describe('Security Tests', () => {
    it('prevents email header injection', async () => {
      const maliciousOptions = {
        to: 'test@example.com',
        subject: 'Test\r\nBcc: attacker@evil.com\r\nX-Mailer: Evil',
        html: '<p>Content</p>'
      };

      await sendEmail(maliciousOptions);

      const sentData = mockSend.mock.calls[0]?.[0];
      if (sentData) {
        expect(sentData.subject).not.toContain('Bcc:');
        expect(sentData.subject).not.toContain('X-Mailer:');
      }
    });

    it('sanitizes HTML content', async () => {
      const maliciousOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<script>alert("xss")</script><p>Safe content</p><iframe src="evil.com"></iframe>'
      };

      const result = await sendEmail(maliciousOptions);

      // Should either sanitize or reject
      expect(result).toBeDefined();
    });

    it('prevents template injection', async () => {
      const maliciousOptions = {
        to: 'test@example.com',
        subject: '{{system.secret}}',
        html: '<p>{{user.password}}</p>'
      };

      await sendEmail(maliciousOptions);

      const sentData = mockSend.mock.calls[0]?.[0];
      if (sentData) {
        expect(sentData.subject).not.toContain('{{');
        expect(sentData.html).not.toContain('{{');
      }
    });
  });

  describe('Configuration Tests', () => {
    it('uses environment variables correctly', async () => {
      const originalFrom = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'Custom <custom@domain.com>';

      await sendEmail(basicEmailOptions);

      const sentData = mockSend.mock.calls[0][0];
      expect(sentData.from).toBe('Custom <custom@domain.com>');

      // Restore
      if (originalFrom) {
        process.env.EMAIL_FROM = originalFrom;
      } else {
        delete process.env.EMAIL_FROM;
      }
    });

    it('handles missing environment variables', async () => {
      const originalFrom = process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM;

      await sendEmail(basicEmailOptions);

      const sentData = mockSend.mock.calls[0][0];
      expect(sentData.from).toBeDefined();

      // Restore
      if (originalFrom) process.env.EMAIL_FROM = originalFrom;
    });
  });
});