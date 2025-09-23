import type { Meta, StoryObj } from '@storybook/react';
import RateLimitPanel from './RateLimitPanel';
import { AppTheme } from '../../theme';

const meta: Meta<typeof RateLimitPanel> = {
  title: 'Responses/RateLimitPanel',
  component: RateLimitPanel,
  decorators: [
    (Story) => (
      <AppTheme>
        <Story />
      </AppTheme>
    ),
  ],
  args: {
    lastSnapshot: {
      limitRequests: 1000,
      remainingRequests: 850,
      limitTokens: 2000,
      remainingTokens: 1200,
      resetRequestsSeconds: 30,
      resetTokensSeconds: 60,
      processingMs: 180,
      requestId: 'req-123',
      tenantId: 'tenant-a',
      observedAt: new Date().toISOString(),
    },
    tenants: [
      {
        tenantId: 'tenant-a',
        remainingRequestsPct: 0.85,
        remainingTokensPct: 0.6,
        averageProcessingMs: 160,
        latest: {
          limitRequests: 1000,
          remainingRequests: 850,
          limitTokens: 2000,
          remainingTokens: 1200,
          resetRequestsSeconds: 30,
          resetTokensSeconds: 60,
          processingMs: 180,
          requestId: 'req-123',
          tenantId: 'tenant-a',
          observedAt: new Date().toISOString(),
        },
      },
      {
        tenantId: 'tenant-b',
        remainingRequestsPct: 0.08,
        remainingTokensPct: 0.05,
        alert: 'tokens',
        averageProcessingMs: 220,
        latest: {
          limitRequests: 500,
          remainingRequests: 40,
          limitTokens: 1000,
          remainingTokens: 50,
          resetRequestsSeconds: 25,
          resetTokensSeconds: 40,
          processingMs: 250,
          requestId: 'req-456',
          tenantId: 'tenant-b',
          observedAt: new Date().toISOString(),
        },
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof RateLimitPanel>;

export const Default: Story = {};

export const EmptyState: Story = {
  args: {
    tenants: [],
    lastSnapshot: undefined,
  },
};
