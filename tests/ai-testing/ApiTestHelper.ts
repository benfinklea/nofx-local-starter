/**
 * AI Testing Helper - Direct API testing without browser
 * Allows automated authentication and testing of all endpoints
 */

// Use built-in fetch if available (Node 18+), otherwise import node-fetch
const fetch = globalThis.fetch || require('node-fetch');
import { createHash, randomBytes } from 'crypto';

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface TestProject {
  id: string;
  name: string;
  repo_url?: string;
  local_path?: string;
}

export interface TestRun {
  id: string;
  status: string;
  plan?: any;
  created_at?: string;
}

export class ApiTestHelper {
  private baseUrl: string;
  private testUser: TestUser | null = null;
  private testProject: TestProject | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a unique test user
   */
  generateTestUser(): TestUser {
    const timestamp = Date.now();
    const randomId = randomBytes(4).toString('hex');
    return {
      email: `test.ai.${timestamp}.${randomId}@nofx.test`,
      password: 'TestPass123!@#'
    };
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: any = {
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

  /**
   * Create and authenticate a test user
   */
  async createAndLoginTestUser(): Promise<TestUser> {
    console.log('🔐 Creating test user...');

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
      throw new Error(`Failed to create/login test user: ${error}`);
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    return await this.apiRequest('/api/auth-v2/me');
  }

  /**
   * Create a test project
   */
  async createTestProject(): Promise<TestProject> {
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

  /**
   * List projects
   */
  async listProjects(): Promise<TestProject[]> {
    const response = await this.apiRequest('/api/projects');
    return response.projects || [];
  }

  /**
   * Create a test run
   */
  async createTestRun(customPlan?: any): Promise<TestRun> {
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

    const testRun: TestRun = {
      id: response.id,
      status: response.status,
      plan,
      created_at: new Date().toISOString()
    };

    console.log('✅ Test run created:', testRun.id);
    return testRun;
  }

  /**
   * Get run details
   */
  async getRun(runId: string): Promise<TestRun> {
    const response = await this.apiRequest(`/api/runs/${runId}`);
    return response;
  }

  /**
   * List runs
   */
  async listRuns(limit: number = 10): Promise<TestRun[]> {
    const response = await this.apiRequest(`/api/runs?limit=${limit}`);
    return response.runs || [];
  }

  /**
   * Get run timeline/events
   */
  async getRunTimeline(runId: string): Promise<any[]> {
    const response = await this.apiRequest(`/api/runs/${runId}/timeline`);
    return response || [];
  }

  /**
   * Comprehensive test suite
   */
  async runComprehensiveTest(): Promise<{
    success: boolean;
    results: any;
    errors: string[];
  }> {
    const results: any = {};
    const errors: string[] = [];

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
      results.projects = await this.listProjects();

      // 4. Run Creation Test
      console.log('\n4. Testing Run Creation...');
      results.run = await this.createTestRun();
      results.runDetails = await this.getRun(results.run.id);
      results.runs = await this.listRuns();

      // 5. Timeline Test
      console.log('\n5. Testing Run Timeline...');
      results.timeline = await this.getRunTimeline(results.run.id);

      console.log('\n✅ All tests passed successfully!');
      return { success: true, results, errors };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error('\n❌ Test failed:', errorMsg);
      return { success: false, results, errors };
    }
  }

  /**
   * Quick authentication test
   */
  async testAuthentication(): Promise<boolean> {
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

  /**
   * Quick run creation test
   */
  async testRunCreation(): Promise<TestRun | null> {
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

  /**
   * Cleanup test data
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');
    // Note: Add cleanup logic when delete endpoints are available
    this.testUser = null;
    this.testProject = null;
  }

  /**
   * Get test status summary
   */
  getTestSummary(): any {
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

// Export a singleton instance for easy use
export const aiTestHelper = new ApiTestHelper();