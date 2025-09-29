#!/usr/bin/env node

/**
 * Debug Signup Issue - Investigate why "Create account" link isn't working
 */

const fetch = globalThis.fetch || (() => {
  try {
    return require('node-fetch');
  } catch {
    console.error('❌ fetch not available. Please use Node 18+ or install node-fetch');
    process.exit(1);
  }
})();

async function debugSignupFlow() {
  const baseUrl = 'https://nofx-control-plane.vercel.app';

  console.log('🔍 Debugging signup flow...');
  console.log(`📍 Base URL: ${baseUrl}\n`);

  try {
    // 1. Check if login page is accessible
    console.log('1. Testing login page accessibility...');
    const loginResponse = await fetch(`${baseUrl}/login.html`);
    console.log(`   Login page status: ${loginResponse.status} ${loginResponse.statusText}`);

    if (!loginResponse.ok) {
      console.log('❌ Login page not accessible');
      return;
    }

    // 2. Get login page content
    const loginHtml = await loginResponse.text();
    console.log(`   Login page size: ${loginHtml.length} characters`);

    // 3. Check for signup link in HTML
    const signupLinkMatches = [
      /href="\/signup/gi,
      /href="signup/gi,
      /href=".*signup.*"/gi,
      /Create.*account/gi,
      /Sign.*up/gi,
      /"signup"/gi
    ];

    console.log('\n2. Analyzing signup links in login page...');
    signupLinkMatches.forEach((regex, i) => {
      const matches = loginHtml.match(regex);
      if (matches) {
        console.log(`   ✅ Pattern ${i + 1} found: ${matches.join(', ')}`);
      } else {
        console.log(`   ❌ Pattern ${i + 1} not found: ${regex}`);
      }
    });

    // 4. Check if signup page exists
    console.log('\n3. Testing signup page accessibility...');
    const signupUrls = [
      `${baseUrl}/signup.html`,
      `${baseUrl}/signup`,
      `${baseUrl}/register.html`,
      `${baseUrl}/register`
    ];

    for (const url of signupUrls) {
      try {
        const response = await fetch(url);
        console.log(`   ${url}: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const content = await response.text();
          console.log(`   ✅ Signup page found! Size: ${content.length} characters`);

          // Check if it has a signup form
          if (content.includes('signup') || content.includes('register') || content.includes('create account')) {
            console.log('   ✅ Contains signup-related content');
          }
          break;
        }
      } catch (error) {
        console.log(`   ❌ ${url}: ${error.message}`);
      }
    }

    // 5. Check API endpoints
    console.log('\n4. Testing signup API endpoint...');
    try {
      const signupApiResponse = await fetch(`${baseUrl}/api/auth-v2/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
      });

      const signupApiData = await signupApiResponse.text();
      console.log(`   Signup API status: ${signupApiResponse.status} ${signupApiResponse.statusText}`);
      console.log(`   Signup API response: ${signupApiData.substring(0, 200)}...`);

    } catch (error) {
      console.log(`   ❌ Signup API error: ${error.message}`);
    }

    // 6. Extract and analyze the specific signup link
    console.log('\n5. Extracting signup link details...');
    const signupLinkRegex = /<a[^>]*href="[^"]*signup[^"]*"[^>]*>.*?<\/a>/gi;
    const signupLinks = loginHtml.match(signupLinkRegex);

    if (signupLinks) {
      console.log('   Found signup links:');
      signupLinks.forEach((link, i) => {
        console.log(`   ${i + 1}. ${link}`);

        // Extract href
        const hrefMatch = link.match(/href="([^"]*)"/);
        if (hrefMatch) {
          console.log(`      → Points to: ${hrefMatch[1]}`);
        }
      });
    } else {
      console.log('   ❌ No signup links found in HTML');
    }

    // 7. Check JavaScript console errors (simulate)
    console.log('\n6. Checking for potential JavaScript issues...');
    if (loginHtml.includes('onclick') || loginHtml.includes('addEventListener')) {
      console.log('   ⚠️  Login page uses JavaScript - potential client-side issue');
    }

    if (loginHtml.includes('preventDefault')) {
      console.log('   ⚠️  Page uses preventDefault - might be blocking navigation');
    }

    console.log('\n📊 Summary:');
    console.log('   • Login page is accessible');
    console.log('   • Need to check if signup page exists');
    console.log('   • Need to verify link targets and JavaScript behavior');
    console.log('\n💡 Recommendation: Check browser console for JavaScript errors when clicking "Create account"');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugSignupFlow().catch(console.error);