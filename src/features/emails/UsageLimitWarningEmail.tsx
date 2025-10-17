/**
 * Usage Limit Warning Email Template
 * Sent when user approaches or exceeds usage limits
 */

import * as React from 'react';
import { Button, Heading, Link, Text } from '@react-email/components';
import { BaseEmailTemplate, emailStyles } from './components/BaseEmailTemplate';
import { EMAIL_SETTINGS } from '../../config/email';

export interface UsageLimitWarningEmailProps {
  userName?: string;
  metric: 'runs' | 'api_calls';
  current: number;
  limit: number;
  percentage: number;
  currentPlan: 'free' | 'starter' | 'pro' | 'enterprise';
  upgradeUrl?: string;
  resetDate?: string; // When usage resets (next billing cycle)
}

export default function UsageLimitWarningEmail({
  userName = 'there',
  metric,
  current,
  limit,
  percentage,
  currentPlan,
  upgradeUrl = `${EMAIL_SETTINGS.company.website}/billing`,
  resetDate,
}: UsageLimitWarningEmailProps) {
  const previewText = `${percentage}% of your ${metric.replace('_', ' ')} limit reached`;

  const metricLabel = metric === 'runs' ? 'runs' : 'API calls';
  const isHighWarning = percentage >= 90;
  const isExceeded = percentage >= 100;

  // Calculate what percentage they have left
  const remaining = Math.max(0, limit - current);

  return (
    <BaseEmailTemplate previewText={previewText}>
      <Heading style={emailStyles.heading}>
        {isExceeded ? '⚠️ Usage Limit Exceeded' : `📊 Usage Limit Alert: ${percentage}%`}
      </Heading>

      <Text style={emailStyles.paragraph}>
        Hi {userName},
      </Text>

      <Text style={emailStyles.paragraph}>
        {isExceeded
          ? `You've exceeded your monthly ${metricLabel} limit on the ${currentPlan} plan.`
          : `You've used ${percentage}% of your monthly ${metricLabel} limit.`
        }
      </Text>

      {/* Usage Progress Bar */}
      <div style={{
        margin: '24px 0',
        padding: '20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '14px',
          color: '#374151',
        }}>
          <span style={{ fontWeight: 600 }}>Current Usage</span>
          <span style={{ fontWeight: 600 }}>{percentage}%</span>
        </div>

        <div style={{
          width: '100%',
          height: '24px',
          backgroundColor: '#E5E7EB',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(percentage, 100)}%`,
            height: '100%',
            backgroundColor: isExceeded ? '#EF4444' : isHighWarning ? '#F59E0B' : '#10B981',
            transition: 'width 0.3s ease',
          }} />
        </div>

        <div style={{
          marginTop: '12px',
          fontSize: '14px',
          color: '#6B7280',
          textAlign: 'center',
        }}>
          <strong style={{ color: '#111827' }}>
            {current.toLocaleString()} / {limit.toLocaleString()}
          </strong> {metricLabel} used
          {!isExceeded && remaining > 0 && (
            <span> • <strong style={{ color: '#10B981' }}>{remaining.toLocaleString()}</strong> remaining</span>
          )}
        </div>
      </div>

      {/* Warning Message */}
      {isExceeded ? (
        <div style={{
          ...emailStyles.error,
          marginBottom: '24px',
        }}>
          <Text style={{ margin: 0 }}>
            <strong>🚫 Service Interruption Warning</strong>
            <br />
            <br />
            Your account has exceeded the {metricLabel} limit for the {currentPlan} plan.
            To continue using NOFX without interruption, please upgrade your plan.
          </Text>
        </div>
      ) : isHighWarning ? (
        <div style={{
          ...emailStyles.warning,
          marginBottom: '24px',
        }}>
          <Text style={{ margin: 0 }}>
            <strong>⚠️ High Usage Alert</strong>
            <br />
            <br />
            You're approaching your {metricLabel} limit.
            Consider upgrading to avoid service interruptions.
          </Text>
        </div>
      ) : (
        <div style={{
          ...emailStyles.info,
          marginBottom: '24px',
        }}>
          <Text style={{ margin: 0 }}>
            <strong>📊 Usage Checkpoint</strong>
            <br />
            <br />
            This is a friendly reminder that you've reached {percentage}% of your monthly {metricLabel} limit.
          </Text>
        </div>
      )}

      {/* Reset Date */}
      {resetDate && (
        <Text style={{
          ...emailStyles.paragraph,
          fontSize: '14px',
          color: '#6B7280',
          textAlign: 'center',
          marginBottom: '24px',
        }}>
          📅 Your usage will reset on <strong>{resetDate}</strong>
        </Text>
      )}

      {/* Upgrade CTA */}
      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={upgradeUrl} style={emailStyles.button}>
          {isExceeded ? 'Upgrade Now' : 'View Plans & Upgrade'}
        </Button>
      </div>

      {/* Plan Comparison */}
      <Heading as="h2" style={{ ...emailStyles.heading, fontSize: '18px', marginTop: '32px' }}>
        Available Plans
      </Heading>

      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        fontSize: '14px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <strong>Starter Plan</strong> - $29/month
          <br />
          • 100 runs/month
          <br />
          • 5,000 API calls/month
          <br />
          • Priority support
        </div>

        <div style={{ marginBottom: '12px' }}>
          <strong>Pro Plan</strong> - $99/month
          <br />
          • 1,000 runs/month
          <br />
          • 50,000 API calls/month
          <br />
          • Advanced features
        </div>

        <div>
          <strong>Enterprise Plan</strong> - Custom pricing
          <br />
          • Unlimited runs
          <br />
          • Unlimited API calls
          <br />
          • Dedicated support
        </div>
      </div>

      <Text style={emailStyles.paragraph}>
        You can view your detailed usage statistics and upgrade your plan anytime from your{' '}
        <Link href={`${EMAIL_SETTINGS.company.website}/billing`}>
          billing dashboard
        </Link>.
      </Text>

      <Text style={emailStyles.paragraph}>
        Need help choosing the right plan? Our team is here to assist you at{' '}
        <Link href={`mailto:${EMAIL_SETTINGS.company.supportEmail}`}>
          {EMAIL_SETTINGS.company.supportEmail}
        </Link>.
      </Text>

      <Text style={{ ...emailStyles.paragraph, marginBottom: 0 }}>
        Best regards,
        <br />
        The NOFX Team
      </Text>
    </BaseEmailTemplate>
  );
}

// Export as plain HTML function for testing
export function renderUsageLimitWarningEmail(props: UsageLimitWarningEmailProps): string {
  const metricLabel = props.metric === 'runs' ? 'runs' : 'API calls';

  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Usage Limit Alert: ${props.percentage}%</h1>
        <p>Hi ${props.userName},</p>
        <p>You've used ${props.percentage}% of your monthly ${metricLabel} limit.</p>
        <p>Current: ${props.current} / ${props.limit}</p>
        <a href="${props.upgradeUrl}">View Plans & Upgrade</a>
        ${props.resetDate ? `<p>Usage resets on: ${props.resetDate}</p>` : ''}
      </body>
    </html>
  `;
}
