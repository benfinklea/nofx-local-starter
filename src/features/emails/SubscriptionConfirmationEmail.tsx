/**
 * Subscription Confirmation Email Template
 * Sent when a user subscribes or upgrades their plan
 */

import * as React from 'react';
import { Button, Heading, Hr, Link, Text } from '@react-email/components';
import { BaseEmailTemplate, emailStyles } from './components/BaseEmailTemplate';
import { EMAIL_SETTINGS } from '../../config/email';

export interface SubscriptionConfirmationEmailProps {
  userName?: string;
  planName: string;
  amount: string;
  interval: 'monthly' | 'yearly';
  nextBillingDate: string;
  features: string[];
  invoiceUrl?: string;
  manageUrl?: string;
}

export default function SubscriptionConfirmationEmail({
  userName = 'there',
  planName,
  amount,
  interval,
  nextBillingDate,
  features,
  invoiceUrl,
  manageUrl = `${EMAIL_SETTINGS.company.website}/billing`,
}: SubscriptionConfirmationEmailProps) {
  const previewText = `Your ${planName} subscription is now active`;

  return (
    <BaseEmailTemplate previewText={previewText}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: EMAIL_SETTINGS.branding.successColor,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '32px' }}>✓</span>
        </div>
      </div>

      <Heading style={{ ...emailStyles.heading, textAlign: 'center' }}>
        Subscription Confirmed!
      </Heading>

      <Text style={emailStyles.paragraph}>
        Hi {userName},
      </Text>

      <Text style={emailStyles.paragraph}>
        Your subscription to <strong>{planName}</strong> is now active. Thank you for choosing NOFX
        Control Plane to power your workflows!
      </Text>

      <div style={{
        backgroundColor: EMAIL_SETTINGS.branding.backgroundColor,
        border: `1px solid ${EMAIL_SETTINGS.branding.borderColor}`,
        borderRadius: '8px',
        padding: '16px',
        margin: '24px 0'
      }}>
        <Heading as="h3" style={{ fontSize: '16px', margin: '0 0 12px' }}>
          Subscription Details
        </Heading>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', color: EMAIL_SETTINGS.branding.mutedColor }}>Plan:</td>
              <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{planName}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0', color: EMAIL_SETTINGS.branding.mutedColor }}>Amount:</td>
              <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{amount}/{interval}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0', color: EMAIL_SETTINGS.branding.mutedColor }}>Next billing:</td>
              <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{nextBillingDate}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Heading as="h3" style={{ fontSize: '18px', margin: '24px 0 12px' }}>
        Your Plan Includes:
      </Heading>

      <ul style={{ ...emailStyles.paragraph, paddingLeft: '20px' }}>
        {features.map((feature, index) => (
          <li key={index} style={{ marginBottom: '8px' }}>{feature}</li>
        ))}
      </ul>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        {invoiceUrl && (
          <Button href={invoiceUrl} style={{ ...emailStyles.secondaryButton, marginRight: '12px' }}>
            View Invoice
          </Button>
        )}
        <Button href={manageUrl} style={emailStyles.button}>
          Manage Subscription
        </Button>
      </div>

      <Hr style={{ margin: '32px 0' }} />

      <Text style={{ ...emailStyles.paragraph, fontSize: '14px', color: EMAIL_SETTINGS.branding.mutedColor }}>
        You can manage your subscription, update payment methods, or cancel anytime from your{' '}
        <Link href={manageUrl}>billing dashboard</Link>.
      </Text>
    </BaseEmailTemplate>
  );
}