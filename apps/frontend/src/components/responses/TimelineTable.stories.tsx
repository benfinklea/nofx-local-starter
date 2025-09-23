import type { Meta, StoryObj } from '@storybook/react';
import TimelineTable from './TimelineTable';

const meta: Meta<typeof TimelineTable> = {
  title: 'Responses/TimelineTable',
  component: TimelineTable,
  args: {
    events: [
      { sequence: 1, type: 'response.created', occurredAt: new Date().toISOString() },
      { sequence: 2, type: 'response.output_text.done', occurredAt: new Date().toISOString() },
      { sequence: 3, type: 'response.completed', occurredAt: new Date().toISOString() },
    ],
  },
};

export default meta;

export const Default: StoryObj<typeof TimelineTable> = {};
