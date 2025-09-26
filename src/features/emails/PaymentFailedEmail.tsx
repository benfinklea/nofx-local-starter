/**
 * Payment Failed Email Template
 * Sent when a payment fails and requires user action
 */

import * as React from 'react';
import { Button, Heading, Link, Text } from '@react-email/components';
import { BaseEmailTemplate, emailStyles } from './components/BaseEmailTemplate';
import { EMAIL_SETTINGS } from '../../config/email';

export interface PaymentFailedEmailProps {
  userName?: string;
  amount: string;
  lastFourDigits?: string;
  failureReason?: string;
  updatePaymentUrl?: string;
  retryDate?: string;
}

export default function PaymentFailedEmail({
  userName = 'there',
  amount,
  lastFourDigits,
  failureReason = 'Your payment method was declined',
  updatePaymentUrl = `${EMAIL_SETTINGS.company.website}/billing/payment-methods`,
  retryDate,
}: PaymentFailedEmailProps) {
  const previewText = 'Action required: Payment failed for your NOFX subscription';

  return (
    <BaseEmailTemplate previewText={previewText}>
      <div style={emailStyles.alert}>
        <Heading as="h2" style={{ fontSize: '18px', margin: '0 0 8px', color: '#991B1B' }}>
          ⚠️ Payment Failed - Action Required
        </Heading>
        <Text style={{ margin: 0, fontSize: '14px' }}>
          We were unable to process your payment of <strong>{amount}</strong>.
        </Text>
      </div>

      <Text style={emailStyles.paragraph}>
        Hi {userName},
      </Text>

      <Text style={emailStyles.paragraph}>
        We tried to process your subscription payment but encountered an issue:
      </Text>

      <div style={{
        backgroundColor: '#FEF2F2',
        border: '1px solid #FEE2E2',
        borderRadius: '6px',
        padding: '12px',
        margin: '16px 0'
      }}>
        <Text style={{ margin: 0, color: '#991B1B' }}>
          <strong>Reason:</strong> {failureReason}
          {lastFourDigits && (
            <>
              <br />
              <strong>Card:</strong> •••• {lastFourDigits}
            </>
          )}
          {retryDate && (
            <>
              <br />
              <strong>Next retry:</strong> {retryDate}
            </>
          )}
        </Text>
      </div>

      <Text style={emailStyles.paragraph}>
        To avoid any interruption to your service, please update your payment method as soon as possible.
      </Text>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={updatePaymentUrl} style={{
          ...emailStyles.button,
          backgroundColor: EMAIL_SETTINGS.branding.errorColor
        }}>
          Update Payment Method
        </Button>
      </div>

      <Heading as="h3" style={{ fontSize: '16px', margin: '24px 0 12px' }}>
        What happens next?
      </Heading>

      <ul style={{ ...emailStyles.paragraph, paddingLeft: '20px' }}>
        <li>We'll automatically retry the payment {retryDate ? `on ${retryDate}` : 'in 3 days'}</li>
        <li>If the payment continues to fail, your subscription may be suspended</li>
        <li>Your data will remain safe, but you won't be able to create new runs</li>
      </ul>

      <Text style={emailStyles.paragraph}>
        If you're experiencing issues or believe this is an error, please{' '}
        <Link href={`mailto:${EMAIL_SETTINGS.company.supportEmail}`}>contact our support team</Link>{' '}
        immediately.
      </Text>

      <div style={{
        backgroundColor: EMAIL_SETTINGS.branding.backgroundColor,
        border: `1px solid ${EMAIL_SETTINGS.branding.borderColor}`,
        borderRadius: '6px',
        padding: '12px',
        margin: '24px 0'
      }}>
        <Text style={{ margin: 0, fontSize: '14px' }}>
          <strong>💡 Common reasons for payment failures:</strong>
        </Text>
        <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '14px' }}>
          <li>Insufficient funds</li>
          <li>Card expired or canceled</li>
          <li>Bank declined the transaction</li>
          <li>Incorrect billing information</li>
        </ul>
      </div>
    </BaseEmailTemplate>
  );
}