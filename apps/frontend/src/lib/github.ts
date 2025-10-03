/**
 * GitHub API Client
 * Handles OAuth integration and repository operations
 */

import { auth } from './auth';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

class GitHubService {
  /**
   * Initiate GitHub OAuth flow
   */
  async connectGitHub(): Promise<{ success: boolean; error?: string }> {
    const result = await auth.signInWithOAuth('github');

    if ('error' in result && result.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  /**
   * Disconnect from GitHub by signing out
   */
  async disconnectGitHub(): Promise<{ success: boolean; error?: string }> {
    try {
      await auth.logout();
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect from GitHub:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect'
      };
    }
  }

  /**
   * Get GitHub access token from current user session
   */
  private async getAccessToken(): Promise<string | null> {
    const session = await auth.getSession();

    // Supabase stores provider tokens in session
    const providerToken = session?.provider_token;

    if (!providerToken) {
      console.warn('No GitHub provider token found in session');
      return null;
    }

    return providerToken;
  }

  /**
   * Fetch user's GitHub repositories
   */
  async listRepositories(): Promise<{ repos: GitHubRepo[]; error?: string }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { repos: [], error: 'Not connected to GitHub. Please sign in with GitHub first.' };
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { repos: [], error: 'GitHub authentication expired. Please reconnect.' };
        }
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const repos: GitHubRepo[] = await response.json();
      return { repos };
    } catch (error) {
      console.error('Failed to fetch GitHub repos:', error);
      return { repos: [], error: error instanceof Error ? error.message : 'Failed to fetch repositories' };
    }
  }

  /**
   * Fetch branches for a specific repository
   */
  async listBranches(owner: string, repo: string): Promise<{ branches: GitHubBranch[]; error?: string }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { branches: [], error: 'Not connected to GitHub' };
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const branches: GitHubBranch[] = await response.json();
      return { branches };
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      return { branches: [], error: error instanceof Error ? error.message : 'Failed to fetch branches' };
    }
  }

  /**
   * Check if user is connected to GitHub
   */
  async isConnected(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Get current GitHub user info
   */
  async getCurrentUser(): Promise<{ login?: string; avatar_url?: string; error?: string }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { error: 'Not connected to GitHub' };
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const user = await response.json();
      return {
        login: user.login,
        avatar_url: user.avatar_url
      };
    } catch (error) {
      console.error('Failed to fetch GitHub user:', error);
      return { error: error instanceof Error ? error.message : 'Failed to fetch user info' };
    }
  }

  /**
   * Create a new repository in the user's GitHub account
   */
  async createRepository(options: {
    name: string;
    description?: string;
    private?: boolean;
    autoInit?: boolean;
  }): Promise<{ repo?: GitHubRepo; error?: string }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { error: 'Not connected to GitHub' };
    }

    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: options.name,
          description: options.description || '',
          private: options.private ?? true,
          auto_init: options.autoInit ?? true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 422 && errorData.errors?.[0]?.message?.includes('already exists')) {
          return { error: 'A repository with this name already exists in your account' };
        }
        throw new Error(errorData.message || `GitHub API error: ${response.statusText}`);
      }

      const repo: GitHubRepo = await response.json();
      return { repo };
    } catch (error) {
      console.error('Failed to create repository:', error);
      return { error: error instanceof Error ? error.message : 'Failed to create repository' };
    }
  }

  /**
   * Fork a repository to the user's GitHub account
   */
  async forkRepository(owner: string, repo: string): Promise<{ repo?: GitHubRepo; error?: string }> {
    const token = await this.getAccessToken();

    if (!token) {
      return { error: 'Not connected to GitHub' };
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403 && errorData.message?.includes('forking is disabled')) {
          return { error: 'This repository does not allow forking' };
        }
        throw new Error(errorData.message || `GitHub API error: ${response.statusText}`);
      }

      const forkedRepo: GitHubRepo = await response.json();
      return { repo: forkedRepo };
    } catch (error) {
      console.error('Failed to fork repository:', error);
      return { error: error instanceof Error ? error.message : 'Failed to fork repository' };
    }
  }
}

// Export singleton instance
export const github = new GitHubService();
