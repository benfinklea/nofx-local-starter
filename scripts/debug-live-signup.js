#!/usr/bin/env node

/**
 * Debug Live Signup - Test what's actually happening on the live site
 */

const fetch = globalThis.fetch || (() => {
  try {
    return require('node-fetch');
  } catch {
    console.error('❌ fetch not available. Please use Node 18+ or install node-fetch');
    process.exit(1);
  }
})();

async function debugLiveSignup() {
  const baseUrl = 'https://nofx-control-plane.vercel.app';

  console.log('🔍 Debugging live signup issue...');
  console.log(`📍 Base URL: ${baseUrl}\n`);

  try {
    // 1. Check main page
    console.log('1. Testing main login page...');
    const mainResponse = await fetch(`${baseUrl}/`);
    const mainHtml = await mainResponse.text();

    console.log(`   Status: ${mainResponse.status}`);
    console.log(`   Size: ${mainHtml.length} characters`);

    // Look for the current JavaScript bundle
    const scriptMatch = mainHtml.match(/src="([^"]*index[^"]*\.js)"/);
    if (scriptMatch) {
      console.log(`   JavaScript bundle: ${scriptMatch[1]}`);
    }

    // 2. Check if the signup route works with hash routing
    console.log('\n2. Testing hash-based signup route...');
    const hashSignupResponse = await fetch(`${baseUrl}/#/signup`);
    console.log(`   Hash signup status: ${hashSignupResponse.status}`);

    // 3. Check if regular signup route works
    console.log('\n3. Testing regular signup route...');
    const signupResponse = await fetch(`${baseUrl}/signup`);
    console.log(`   Regular signup status: ${signupResponse.status}`);

    // 4. Download and analyze the JavaScript bundle to see if our code is there
    if (scriptMatch) {
      console.log('\n4. Analyzing JavaScript bundle for signup code...');
      try {
        const jsResponse = await fetch(`${baseUrl}${scriptMatch[1]}`);
        const jsContent = await jsResponse.text();

        const signupChecks = [
          { name: 'SignupForm component', pattern: /SignupForm/g },
          { name: 'Create Account text', pattern: /Create Account/g },
          { name: 'signup route', pattern: /\/signup/g },
          { name: 'Join NOFX text', pattern: /Join NOFX/g }
        ];

        signupChecks.forEach(check => {
          const matches = jsContent.match(check.pattern);
          if (matches) {
            console.log(`   ✅ Found ${check.name}: ${matches.length} occurrences`);
          } else {
            console.log(`   ❌ Missing ${check.name}`);
          }
        });

        // Check if our new bundle hash is different
        const currentBundle = scriptMatch[1];
        if (currentBundle.includes('BvGSOcNN')) {
          console.log('   ⚠️  Still using old bundle - deployment may not be complete');
        } else {
          console.log('   ✅ Using new bundle');
        }

      } catch (error) {
        console.log(`   ❌ Could not analyze bundle: ${error.message}`);
      }
    }

    // 5. Check deployment status
    console.log('\n5. Checking latest deployment...');
    const latestCommit = 'a87f159'; // Our commit hash

    // Try to detect if the site has our changes
    const hasSignupChanges = mainHtml.includes('signup') ||
                           mainHtml.includes('SignupForm') ||
                           (scriptMatch && !scriptMatch[1].includes('BvGSOcNN'));

    console.log(`   Latest commit: ${latestCommit}`);
    console.log(`   Deployment has signup changes: ${hasSignupChanges ? '✅ YES' : '❌ NO'}`);

    // 6. Test actual browser behavior simulation
    console.log('\n6. Simulating browser behavior...');

    if (!hasSignupChanges) {
      console.log('❌ ISSUE IDENTIFIED: Deployment does not contain our signup changes');
      console.log('\n💡 Possible causes:');
      console.log('   1. Vercel deployment failed or is still in progress');
      console.log('   2. Build process excluded our changes');
      console.log('   3. Caching issues preventing new code from loading');
      console.log('   4. Frontend build didn\'t include the new component');

      console.log('\n🔧 Recommended actions:');
      console.log('   1. Check Vercel deployment logs');
      console.log('   2. Rebuild and redeploy the frontend');
      console.log('   3. Verify the build includes SignupForm.tsx');
      console.log('   4. Clear Vercel cache and redeploy');
    } else {
      console.log('✅ Deployment appears to contain our changes');
      console.log('   The issue might be with routing or component rendering');
    }

    return { success: hasSignupChanges, deploymentStatus: hasSignupChanges ? 'updated' : 'outdated' };

  } catch (error) {
    console.error('❌ Debug failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the debug
debugLiveSignup()
  .then(result => {
    console.log('\n📊 Summary:');
    console.log(`   Deployment status: ${result.deploymentStatus || 'unknown'}`);
    console.log(`   Fix deployed: ${result.success ? 'YES' : 'NO'}`);

    if (!result.success) {
      console.log('\n🚨 CONCLUSION: The signup fix has NOT been deployed to production');
      console.log('   You need to rebuild and redeploy the frontend with the signup changes');
    }

    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });