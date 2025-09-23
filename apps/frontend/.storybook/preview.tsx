import type { Preview } from '@storybook/react';
import * as React from 'react';
import { AppTheme } from '../src/theme';

const preview: Preview = {
  decorators: [
    (Story) => (
      <AppTheme>
        <Story />
      </AppTheme>
    ),
  ],
};

export default preview;
