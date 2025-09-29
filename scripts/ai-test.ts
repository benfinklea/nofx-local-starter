#!/usr/bin/env ts-node

/**
 * AI Testing CLI - Quick test runner for authentication and run creation
 * Usage: npm run ai-test [command]
 */

import { ApiTestHelper } from '../tests/ai-testing/ApiTestHelper';

async function main() {
  const command = process.argv[2] || 'comprehensive';
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  const apiHelper = new ApiTestHelper(baseUrl);

  console.log(`🤖 AI Testing CLI`);
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`🎯 Command: ${command}\n`);

  try {
    switch (command) {
      case 'auth':
        console.log('Testing authentication only...');
        const authSuccess = await apiHelper.testAuthentication();
        process.exit(authSuccess ? 0 : 1);

      case 'run':
        console.log('Testing run creation only...');
        const run = await apiHelper.testRunCreation();
        if (run) {
          console.log(`✅ Run created: ${run.id}`);
          process.exit(0);
        } else {
          process.exit(1);
        }

      case 'status':
        console.log('Getting test status...');
        console.log(JSON.stringify(apiHelper.getTestSummary(), null, 2));
        process.exit(0);

      case 'comprehensive':
      default:
        console.log('Running comprehensive test suite...');
        const result = await apiHelper.runComprehensiveTest();

        console.log('\n📊 Test Results Summary:');
        console.log(`Success: ${result.success}`);
        console.log(`Errors: ${result.errors.length}`);

        if (result.errors.length > 0) {
          console.log('\n❌ Errors:');
          result.errors.forEach((error, i) => {
            console.log(`  ${i + 1}. ${error}`);
          });
        }

        if (result.success) {
          console.log('\n✅ Key Results:');
          if (result.results.user) {
            console.log(`  User: ${result.results.user.email} (${result.results.user.id})`);
          }
          if (result.results.project) {
            console.log(`  Project: ${result.results.project.name} (${result.results.project.id})`);
          }
          if (result.results.run) {
            console.log(`  Run: ${result.results.run.id} (${result.results.run.status})`);
          }
        }

        process.exit(result.success ? 0 : 1);
    }
  } catch (error) {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  }
}

// Handle CLI execution
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}