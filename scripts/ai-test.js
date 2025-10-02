#!/usr/bin/env node

/**
 * AI Testing CLI - Quick test runner for authentication and run creation
 * Usage: node scripts/ai-test.js [command]
 */

const { randomBytes } = require('crypto');

// Use built-in fetch if available (Node 18+), otherwise require node-fetch
const fetch = globalThis.fetch || (() => {
  try {
    return require('node-fetch');
  } catch {
    console.error('❌ fetch not available. Please use Node 18+ or install node-fetch');
    process.exit(1);
  }
})();

class ApiTestHelper {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.testUser = null;
    this.testProject = null;
  }

  generateTestUser() {
    const timestamp = Date.now();
    const randomId = randomBytes(4).toString('hex');
    return {
      email: `aitest${randomId}@example.com`,
      password: 'SuperSecureTestPassword123!@#$%^&*()_+='
    };
  }

  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    if (this.testUser?.access_token) {
      headers['Authorization'] = `Bearer ${this.testUser.access_token}`;
    }

    // Add project header if available
    if (this.testProject?.id) {
      headers['x-project-id'] = this.testProject.id;
    }

    console.log(`🌐 API ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers,
      method: options.method || 'GET'
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (!response.ok) {
      console.error(`❌ API Error ${response.status}:`, responseData);
      throw new Error(`API Error ${response.status}: ${JSON.stringify(responseData)}`);
    }

    console.log(`✅ API Success ${response.status}`);
    return responseData;
  }

  async createAndLoginTestUser() {
    console.log('🔐 Creating test user...');

    // Try environment variables first
    if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
      const envUser = {
        email: process.env.TEST_EMAIL,
        password: process.env.TEST_PASSWORD
      };

      try {
        console.log(`🔑 Trying environment user: ${envUser.email}`);
        const loginData = await this.apiRequest('/api/auth-v2/login', {
          method: 'POST',
          body: JSON.stringify(envUser)
        });

        this.testUser = {
          ...envUser,
          access_token: loginData.session?.access_token,
          refresh_token: loginData.session?.refresh_token,
          id: loginData.user?.id
        };

        console.log('✅ Test user login successful with environment credentials');
        return this.testUser;
      } catch (error) {
        console.log(`❌ Environment user ${envUser.email} failed: ${error.message.split(':')[0]}`);
      }
    }

    // Try predefined test credentials
    const predefinedUsers = [
      { email: 'test@test.com', password: 'password123' },
      { email: 'demo@demo.com', password: 'demo123' },
      { email: 'admin@example.com', password: 'admin123' }
    ];

    // Try each predefined user
    for (const user of predefinedUsers) {
      try {
        console.log(`🔑 Trying predefined user: ${user.email}`);
        const loginData = await this.apiRequest('/api/auth-v2/login', {
          method: 'POST',
          body: JSON.stringify(user)
        });

        this.testUser = {
          ...user,
          access_token: loginData.session?.access_token,
          refresh_token: loginData.session?.refresh_token,
          id: loginData.user?.id
        };

        console.log('✅ Test user login successful with predefined credentials');
        return this.testUser;
      } catch (error) {
        console.log(`❌ Predefined user ${user.email} failed: ${error.message.split(':')[0]}`);
      }
    }

    // If predefined users fail, try creating a new one
    this.testUser = this.generateTestUser();

    try {
      // Try to signup first
      const signupData = await this.apiRequest('/api/auth-v2/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: this.testUser.email,
          password: this.testUser.password,
          fullName: 'AI Test User'
        })
      });

      console.log('✅ Test user created successfully');

      // If signup provides a session, use it
      if (signupData.session?.access_token) {
        this.testUser.access_token = signupData.session.access_token;
        this.testUser.refresh_token = signupData.session.refresh_token;
        this.testUser.id = signupData.user?.id;
        return this.testUser;
      }
    } catch (error) {
      console.log('ℹ️ Signup failed, trying login (user might exist)');
    }

    // Try to login
    try {
      const loginData = await this.apiRequest('/api/auth-v2/login', {
        method: 'POST',
        body: JSON.stringify({
          email: this.testUser.email,
          password: this.testUser.password
        })
      });

      this.testUser.access_token = loginData.session?.access_token;
      this.testUser.refresh_token = loginData.session?.refresh_token;
      this.testUser.id = loginData.user?.id;

      console.log('✅ Test user login successful');
      return this.testUser;
    } catch (error) {
      // If all else fails, provide helpful guidance
      console.log('\n🚨 Could not authenticate with any method.');
      console.log('💡 To use AI testing, please:');
      console.log('   1. Create a test user manually at https://nofx-local-starter.vercel.app');
      console.log('   2. Set environment variables:');
      console.log('      export TEST_EMAIL="your-test@email.com"');
      console.log('      export TEST_PASSWORD="your-password"');
      console.log('   3. Or modify the predefined users in this script');

      throw new Error(`Failed to create/login test user: ${error}`);
    }
  }

  async getCurrentUser() {
    return await this.apiRequest('/api/auth-v2/me');
  }

  async createTestProject() {
    console.log('📁 Creating test project...');

    const projectData = {
      name: `AI Test Project ${Date.now()}`,
      local_path: '/tmp/test-project',
      workspace_mode: 'local'
    };

    const response = await this.apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });

    this.testProject = {
      id: response.id,
      name: response.name,
      local_path: response.local_path
    };

    console.log('✅ Test project created:', this.testProject.id);
    return this.testProject;
  }

  async createTestRun(customPlan) {
    console.log('🚀 Creating test run...');

    const defaultPlan = {
      goal: "Test run created by AI testing system",
      steps: [
        {
          name: "Initialize test environment",
          tool: "bash",
          inputs: { command: "echo 'AI test run started'" }
        },
        {
          name: "Verify system status",
          tool: "info",
          inputs: { message: "System operational" }
        }
      ]
    };

    const plan = customPlan || defaultPlan;

    const response = await this.apiRequest('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ plan })
    });

    const testRun = {
      id: response.id,
      status: response.status,
      plan,
      created_at: new Date().toISOString()
    };

    console.log('✅ Test run created:', testRun.id);
    return testRun;
  }

  async testAuthentication() {
    try {
      await this.createAndLoginTestUser();
      await this.getCurrentUser();
      console.log('✅ Authentication test passed');
      return true;
    } catch (error) {
      console.error('❌ Authentication test failed:', error);
      return false;
    }
  }

  async testRunCreation() {
    try {
      if (!this.testUser) {
        await this.createAndLoginTestUser();
      }

      if (!this.testProject) {
        await this.createTestProject();
      }

      const run = await this.createTestRun();
      console.log('✅ Run creation test passed');
      return run;
    } catch (error) {
      console.error('❌ Run creation test failed:', error);
      return null;
    }
  }

  async runComprehensiveTest() {
    const results = {};
    const errors = [];

    try {
      console.log('🧪 Starting comprehensive AI test suite...');

      // 1. Authentication Test
      console.log('\n1. Testing Authentication...');
      results.user = await this.createAndLoginTestUser();

      // 2. User Info Test
      console.log('\n2. Testing User Info...');
      results.currentUser = await this.getCurrentUser();

      // 3. Project Management Test
      console.log('\n3. Testing Project Management...');
      results.project = await this.createTestProject();

      // 4. Run Creation Test
      console.log('\n4. Testing Run Creation...');
      results.run = await this.createTestRun();

      console.log('\n✅ All tests passed successfully!');
      return { success: true, results, errors };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error('\n❌ Test failed:', errorMsg);
      return { success: false, results, errors };
    }
  }

  getTestSummary() {
    return {
      authenticated: !!this.testUser?.access_token,
      user: this.testUser ? {
        email: this.testUser.email,
        id: this.testUser.id
      } : null,
      project: this.testProject,
      baseUrl: this.baseUrl
    };
  }
}

async function main() {
  const command = process.argv[2] || 'comprehensive';
  const baseUrl = process.env.API_URL || 'https://nofx-local-starter.vercel.app';

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