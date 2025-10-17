/**
 * Password Reset Email Template
 * Sent when user requests a password reset
 */

import * as React from 'react';
import { Button, Heading, Link, Text } from '@react-email/components';
import { BaseEmailTemplate, emailStyles } from './components/BaseEmailTemplate';
import { EMAIL_SETTINGS } from '../../config/email';

export interface PasswordResetEmailProps {
  userEmail: string;
  userName?: string;
  resetUrl: string;
  expiryMinutes?: number;
}

export default function PasswordResetEmail({
  userEmail,
  userName = 'there',
  resetUrl,
  expiryMinutes = 60,
}: PasswordResetEmailProps) {
  const previewText = 'Reset your NOFX password - Link expires soon';

  return (
    <BaseEmailTemplate previewText={previewText}>
      <Heading style={emailStyles.heading}>
        Reset Your Password
      </Heading>

      <Text style={emailStyles.paragraph}>
        Hi {userName},
      </Text>

      <Text style={emailStyles.paragraph}>
        We received a request to reset the password for your NOFX account ({userEmail}).
        Click the button below to create a new password:
      </Text>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={resetUrl} style={emailStyles.button}>
          Reset Password
        </Button>
      </div>

      <div style={emailStyles.warning}>
        <Text style={{ margin: 0 }}>
          <strong>⏰ This link will expire in {expiryMinutes} minutes.</strong>
          <br />
          For security reasons, please reset your password as soon as possible.
        </Text>
      </div>

      <Text style={emailStyles.paragraph}>
        If the button above doesn't work, copy and paste this link into your browser:
      </Text>

      <div style={{
        padding: '12px',
        backgroundColor: '#F3F4F6',
        borderRadius: '4px',
        wordBreak: 'break-all',
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#374151',
      }}>
        {resetUrl}
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: '4px',
      }}>
        <Text style={{ margin: 0, fontSize: '14px', color: '#92400E' }}>
          <strong>🔒 Security Notice</strong>
          <br />
          <br />
          • If you didn't request this password reset, please ignore this email
          <br />
          • Your password will remain unchanged
          <br />
          • Consider enabling two-factor authentication for added security
          <br />
          • Never share your password reset link with anyone
        </Text>
      </div>

      <Text style={emailStyles.paragraph}>
        After resetting your password, you'll be able to log in immediately with your new credentials.
      </Text>

      <Text style={emailStyles.paragraph}>
        If you're having trouble resetting your password or didn't request this change,
        please contact our support team immediately at{' '}
        <Link href={`mailto:${EMAIL_SETTINGS.company.supportEmail}`}>
          {EMAIL_SETTINGS.company.supportEmail}
        </Link>.
      </Text>

      <Text style={{ ...emailStyles.paragraph, marginBottom: 0 }}>
        Best regards,
        <br />
        The NOFX Security Team
      </Text>
    </BaseEmailTemplate>
  );
}

// Export as plain HTML function for testing
export function renderPasswordResetEmail(props: PasswordResetEmailProps): string {
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Reset Your Password</h1>
        <p>Hi ${props.userName},</p>
        <p>We received a request to reset the password for your NOFX account (${props.userEmail}).</p>
        <a href="${props.resetUrl}">Reset Password</a>
        <p>This link will expire in ${props.expiryMinutes} minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </body>
    </html>
  `;
}
