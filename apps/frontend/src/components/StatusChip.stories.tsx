import type { Meta, StoryObj } from '@storybook/react';
import StatusChip from './StatusChip';

const meta: Meta<typeof StatusChip> = {
  title: 'Atoms/StatusChip',
  component: StatusChip,
  args: {
    status: 'completed',
  },
};

export default meta;

type Story = StoryObj<typeof StatusChip>;

export const Completed: Story = { args: { status: 'completed' } };
export const Failed: Story = { args: { status: 'failed' } };
export const Running: Story = { args: { status: 'running' } };
export const Unknown: Story = { args: { status: 'mystery' } };
