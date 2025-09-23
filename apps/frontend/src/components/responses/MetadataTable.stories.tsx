import type { Meta, StoryObj } from '@storybook/react';
import MetadataTable from './MetadataTable';

const meta: Meta<typeof MetadataTable> = {
  title: 'Responses/MetadataTable',
  component: MetadataTable,
  args: {
    metadata: {
      tenant_id: 'tenant-a',
      region: 'us-east',
      traceId: 'trace-1234',
    },
  },
};

export default meta;

export const Default: StoryObj<typeof MetadataTable> = {};
