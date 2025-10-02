/**
 * Email Configuration for NOFX
 * Centralized email settings and templates configuration
 */

export const EMAIL_SETTINGS = {
  // Company information
  company: {
    name: 'NOFX Control Plane',
    website: 'https://nofx-local-starter.vercel.app',
    supportEmail: 'support@nofx-local-starter.com',
    logo: 'https://nofx-local-starter.vercel.app/logo.png',
    address: 'Your Company Address',
  },

  // Email branding
  branding: {
    primaryColor: '#3B82F6', // Blue
    secondaryColor: '#1E40AF', // Dark Blue
    backgroundColor: '#F9FAFB',
    textColor: '#111827',
    mutedColor: '#6B7280',
    borderColor: '#E5E7EB',
    successColor: '#10B981',
    errorColor: '#EF4444',
    warningColor: '#F59E0B',
  },

  // Email categories
  categories: {
    transactional: {
      welcome: {
        subject: 'Welcome to NOFX Control Plane!',
        preheader: 'Get started with your new account',
      },
      passwordReset: {
        subject: 'Reset Your Password',
        preheader: 'Reset your NOFX password',
      },
      emailVerification: {
        subject: 'Verify Your Email',
        preheader: 'Please verify your email address',
      },
    },
    billing: {
      subscriptionConfirmed: {
        subject: 'Subscription Confirmed',
        preheader: 'Your subscription is now active',
      },
      paymentSucceeded: {
        subject: 'Payment Successful',
        preheader: 'Your payment has been processed',
      },
      paymentFailed: {
        subject: 'Payment Failed - Action Required',
        preheader: 'We couldn\'t process your payment',
      },
      subscriptionCanceled: {
        subject: 'Subscription Canceled',
        preheader: 'Your subscription has been canceled',
      },
      subscriptionUpdated: {
        subject: 'Subscription Updated',
        preheader: 'Your subscription has been modified',
      },
      trialEnding: {
        subject: 'Your Trial is Ending Soon',
        preheader: 'Upgrade to continue using NOFX',
      },
    },
    usage: {
      limitWarning: {
        subject: 'Usage Limit Warning',
        preheader: 'You\'re approaching your usage limits',
      },
      limitExceeded: {
        subject: 'Usage Limit Exceeded',
        preheader: 'You\'ve exceeded your plan limits',
      },
      monthlyReport: {
        subject: 'Your Monthly Usage Report',
        preheader: 'See your NOFX usage for this month',
      },
    },
    team: {
      invitation: {
        subject: 'You\'ve been invited to join a team',
        preheader: 'Join your team on NOFX',
      },
      memberAdded: {
        subject: 'New Team Member Added',
        preheader: 'A new member joined your team',
      },
      memberRemoved: {
        subject: 'Team Member Removed',
        preheader: 'A member was removed from your team',
      },
      roleChanged: {
        subject: 'Your Team Role Has Changed',
        preheader: 'Your permissions have been updated',
      },
    },
    security: {
      newLogin: {
        subject: 'New Login to Your Account',
        preheader: 'We detected a new login',
      },
      apiKeyCreated: {
        subject: 'API Key Created',
        preheader: 'A new API key was created',
      },
      suspiciousActivity: {
        subject: 'Suspicious Activity Detected',
        preheader: 'Unusual activity on your account',
      },
    },
  },

  // Footer links
  footer: {
    links: [
      { text: 'Documentation', href: 'https://nofx-local-starter.vercel.app/docs' },
      { text: 'Support', href: 'mailto:support@nofx-local-starter.com' },
      { text: 'Privacy Policy', href: 'https://nofx-local-starter.vercel.app/privacy' },
      { text: 'Terms of Service', href: 'https://nofx-local-starter.vercel.app/terms' },
    ],
    social: [
      { platform: 'GitHub', href: 'https://github.com/nofx' },
      { platform: 'Twitter', href: 'https://twitter.com/nofx' },
      { platform: 'LinkedIn', href: 'https://linkedin.com/company/nofx' },
    ],
  },

  // Unsubscribe settings
  unsubscribe: {
    enabled: true,
    text: 'You received this email because you have an account with NOFX.',
    linkText: 'Unsubscribe',
    manageText: 'Manage email preferences',
  },
};

/**
 * Get email subject with optional customization
 */
export function getEmailSubject(category: string, type: string, customSubject?: string): string {
  if (customSubject) return customSubject;

  const categoryConfig = EMAIL_SETTINGS.categories[category as keyof typeof EMAIL_SETTINGS.categories];
  if (!categoryConfig) return 'NOFX Control Plane Notification';

  const typeConfig = categoryConfig[type as keyof typeof categoryConfig];
  if (!typeConfig) return 'NOFX Control Plane Notification';

  return (typeConfig as any).subject || 'NOFX Control Plane Notification';
}

/**
 * Get email preheader text
 */
export function getEmailPreheader(category: string, type: string): string {
  const categoryConfig = EMAIL_SETTINGS.categories[category as keyof typeof EMAIL_SETTINGS.categories];
  if (!categoryConfig) return '';

  const typeConfig = categoryConfig[type as keyof typeof categoryConfig];
  if (!typeConfig) return '';

  return (typeConfig as any).preheader || '';
}