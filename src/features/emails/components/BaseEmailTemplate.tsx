/**
 * Base Email Template Component
 * Provides consistent layout and styling for all emails
 */

import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { EMAIL_SETTINGS } from '../../../config/email';

export interface BaseEmailTemplateProps {
  previewText?: string;
  children: React.ReactNode;
  showFooter?: boolean;
  showUnsubscribe?: boolean;
}

export function BaseEmailTemplate({
  previewText = '',
  children,
  showFooter = true,
  showUnsubscribe = true,
}: BaseEmailTemplateProps) {
  const { company, branding, footer, unsubscribe } = EMAIL_SETTINGS;

  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={body}>
        <Container style={container}>
          {/* Logo Header */}
          <Section style={header}>
            <Link href={company.website} style={logoLink}>
              <Text style={logoText}>{company.name}</Text>
            </Link>
          </Section>

          {/* Main Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          {showFooter && (
            <>
              <Hr style={hr} />
              <Section style={footerSection}>
                {/* Footer Links */}
                <Text style={footerLinks}>
                  {footer.links.map((link, index) => (
                    <React.Fragment key={link.text}>
                      {index > 0 && <span style={separator}> · </span>}
                      <Link href={link.href} style={footerLink}>
                        {link.text}
                      </Link>
                    </React.Fragment>
                  ))}
                </Text>

                {/* Company Info */}
                <Text style={footerText}>
                  © {new Date().getFullYear()} {company.name}. All rights reserved.
                </Text>

                {/* Unsubscribe */}
                {showUnsubscribe && unsubscribe.enabled && (
                  <Text style={unsubscribeText}>
                    {unsubscribe.text}{' '}
                    <Link href={`${company.website}/settings/emails`} style={unsubscribeLink}>
                      {unsubscribe.manageText}
                    </Link>
                  </Text>
                )}
              </Section>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const body = {
  backgroundColor: EMAIL_SETTINGS.branding.backgroundColor,
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const header = {
  padding: '24px 0',
  textAlign: 'center' as const,
};

const logoLink = {
  textDecoration: 'none',
};

const logoText = {
  color: EMAIL_SETTINGS.branding.primaryColor,
  fontSize: '24px',
  fontWeight: 'bold',
  textDecoration: 'none',
};

const content = {
  padding: '24px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: `1px solid ${EMAIL_SETTINGS.branding.borderColor}`,
};

const hr = {
  borderColor: EMAIL_SETTINGS.branding.borderColor,
  margin: '32px 0',
};

const footerSection = {
  textAlign: 'center' as const,
  padding: '24px',
};

const footerLinks = {
  color: EMAIL_SETTINGS.branding.textColor,
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const footerLink = {
  color: EMAIL_SETTINGS.branding.textColor,
  textDecoration: 'underline',
};

const separator = {
  color: EMAIL_SETTINGS.branding.mutedColor,
  margin: '0 8px',
};

const footerText = {
  color: EMAIL_SETTINGS.branding.mutedColor,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px',
};

const unsubscribeText = {
  color: EMAIL_SETTINGS.branding.mutedColor,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0',
};

const unsubscribeLink = {
  color: EMAIL_SETTINGS.branding.mutedColor,
  textDecoration: 'underline',
};

// Export common styles for use in email templates
export const emailStyles = {
  heading: {
    color: EMAIL_SETTINGS.branding.textColor,
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 16px',
  },
  paragraph: {
    color: EMAIL_SETTINGS.branding.textColor,
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  button: {
    backgroundColor: EMAIL_SETTINGS.branding.primaryColor,
    borderRadius: '6px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: 'bold',
    padding: '12px 24px',
    textDecoration: 'none',
    textAlign: 'center' as const,
  },
  secondaryButton: {
    backgroundColor: EMAIL_SETTINGS.branding.backgroundColor,
    border: `2px solid ${EMAIL_SETTINGS.branding.primaryColor}`,
    borderRadius: '6px',
    color: EMAIL_SETTINGS.branding.primaryColor,
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: 'bold',
    padding: '10px 22px',
    textDecoration: 'none',
    textAlign: 'center' as const,
  },
  code: {
    backgroundColor: EMAIL_SETTINGS.branding.backgroundColor,
    border: `1px solid ${EMAIL_SETTINGS.branding.borderColor}`,
    borderRadius: '4px',
    color: EMAIL_SETTINGS.branding.textColor,
    display: 'inline-block',
    fontFamily: 'monospace',
    fontSize: '14px',
    padding: '4px 8px',
  },
  alert: {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FEE2E2',
    borderRadius: '6px',
    color: '#991B1B',
    padding: '12px',
    margin: '16px 0',
  },
  success: {
    backgroundColor: '#F0FDF4',
    border: '1px solid #DCFCE7',
    borderRadius: '6px',
    color: '#166534',
    padding: '12px',
    margin: '16px 0',
  },
};