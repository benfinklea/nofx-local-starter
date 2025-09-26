/**
 * Welcome Email Template
 * Sent to new users after signup
 */

import * as React from 'react';
import { Button, Heading, Link, Text } from '@react-email/components';
import { BaseEmailTemplate, emailStyles } from './components/BaseEmailTemplate';
import { EMAIL_SETTINGS } from '../../config/email';

export interface WelcomeEmailProps {
  userEmail: string;
  userName?: string;
  loginUrl?: string;
  tier?: 'free' | 'starter' | 'pro' | 'enterprise';
}

export default function WelcomeEmail({
  userEmail,
  userName = 'there',
  loginUrl = `${EMAIL_SETTINGS.company.website}/login`,
  tier = 'free',
}: WelcomeEmailProps) {
  const previewText = 'Welcome to NOFX Control Plane - Get started with your new account';

  const tierFeatures = {
    free: {
      runs: '10 runs/month',
      apiCalls: '100 API calls/month',
      rateLimit: '10 requests/minute',
    },
    starter: {
      runs: '100 runs/month',
      apiCalls: '5,000 API calls/month',
      rateLimit: '30 requests/minute',
    },
    pro: {
      runs: '1,000 runs/month',
      apiCalls: '50,000 API calls/month',
      rateLimit: '60 requests/minute',
    },
    enterprise: {
      runs: 'Unlimited runs',
      apiCalls: 'Unlimited API calls',
      rateLimit: '200 requests/minute',
    },
  };

  const features = tierFeatures[tier];

  return (
    <BaseEmailTemplate previewText={previewText}>
      <Heading style={emailStyles.heading}>
        Welcome to NOFX, {userName}! 🚀
      </Heading>

      <Text style={emailStyles.paragraph}>
        Thank you for signing up for NOFX Control Plane. Your account has been successfully created
        and you're ready to start orchestrating your AI-powered workflows.
      </Text>

      <Text style={emailStyles.paragraph}>
        Your account ({userEmail}) is currently on the <strong>{tier}</strong> plan, which includes:
      </Text>

      <ul style={{ ...emailStyles.paragraph, paddingLeft: '20px' }}>
        <li>{features.runs}</li>
        <li>{features.apiCalls}</li>
        <li>{features.rateLimit}</li>
      </ul>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={loginUrl} style={emailStyles.button}>
          Get Started
        </Button>
      </div>

      <Heading as="h2" style={{ ...emailStyles.heading, fontSize: '18px' }}>
        Quick Start Guide
      </Heading>

      <Text style={emailStyles.paragraph}>Here's how to get started:</Text>

      <ol style={{ ...emailStyles.paragraph, paddingLeft: '20px' }}>
        <li>
          <Link href={`${EMAIL_SETTINGS.company.website}/docs/quickstart`}>
            Read the Quick Start Guide
          </Link>{' '}
          to understand the basics
        </li>
        <li>
          <Link href={`${EMAIL_SETTINGS.company.website}/settings/api-keys`}>
            Generate your first API key
          </Link>{' '}
          for programmatic access
        </li>
        <li>
          <Link href={`${EMAIL_SETTINGS.company.website}/runs/new`}>
            Create your first run
          </Link>{' '}
          to see NOFX in action
        </li>
        <li>
          <Link href={`${EMAIL_SETTINGS.company.website}/docs`}>
            Explore the documentation
          </Link>{' '}
          for advanced features
        </li>
      </ol>

      <div style={emailStyles.success}>
        <Text style={{ margin: 0 }}>
          <strong>💡 Pro Tip:</strong> Check out our{' '}
          <Link href={`${EMAIL_SETTINGS.company.website}/templates`}>
            template library
          </Link>{' '}
          for ready-to-use workflows!
        </Text>
      </div>

      <Text style={emailStyles.paragraph}>
        If you have any questions or need help getting started, our support team is here to help.
        Just reply to this email or visit our{' '}
        <Link href={`${EMAIL_SETTINGS.company.website}/support`}>support center</Link>.
      </Text>

      <Text style={{ ...emailStyles.paragraph, marginBottom: 0 }}>
        Happy building!
        <br />
        The NOFX Team
      </Text>
    </BaseEmailTemplate>
  );
}

// Export as plain HTML function for testing
export function renderWelcomeEmail(props: WelcomeEmailProps): string {
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Welcome to NOFX, ${props.userName}!</h1>
        <p>Your account (${props.userEmail}) has been created.</p>
        <a href="${props.loginUrl}">Get Started</a>
      </body>
    </html>
  `;
}