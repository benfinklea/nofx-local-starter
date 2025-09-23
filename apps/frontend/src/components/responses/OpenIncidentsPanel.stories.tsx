import type { Meta, StoryObj } from '@storybook/react';
import OpenIncidentsPanel from './OpenIncidentsPanel';
import { AppTheme } from '../../theme';

const meta: Meta<typeof OpenIncidentsPanel> = {
  title: 'Responses/OpenIncidentsPanel',
  component: OpenIncidentsPanel,
  decorators: [
    (Story) => (
      <AppTheme>
        <Story />
      </AppTheme>
    ),
  ],
  args: {
    incidents: [
      {
        id: 'inc-1',
        runId: 'resp-123',
        type: 'retry',
        status: 'open',
        sequence: 4,
        occurredAt: new Date().toISOString(),
      },
      {
        id: 'inc-2',
        runId: 'resp-456',
        type: 'safety',
        status: 'open',
        sequence: 9,
        occurredAt: new Date().toISOString(),
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof OpenIncidentsPanel>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    incidents: [],
  },
};
