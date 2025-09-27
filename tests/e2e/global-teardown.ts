import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');

  try {
    // Clean up authentication files
    const authDir = path.join(__dirname, '.auth');
    if (fs.existsSync(authDir)) {
      const authFiles = fs.readdirSync(authDir);
      for (const file of authFiles) {
        const filePath = path.join(authDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleaned up auth file: ${file}`);
      }
    }

    // Clean up test artifacts (optional)
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (fs.existsSync(resultsDir)) {
      console.log('📁 Test results saved in test-results/');
    }

    console.log('✅ Playwright global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown error:', error);
    // Don't throw - teardown errors shouldn't fail the test suite
  }
}

export default globalTeardown;