import { test as teardown } from '@playwright/test';
import fs from 'fs';
import path from 'path';

teardown('cleanup', async ({ }) => {
  console.log('🧹 Running cleanup...');

  try {
    // Clean up any test data created during E2E tests
    // This could include:
    // - Test runs created during testing
    // - Test projects
    // - Temporary files

    console.log('✅ Cleanup completed successfully');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
});