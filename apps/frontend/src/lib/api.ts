import { apiBase } from '../config';
import { auth } from './auth';
import { safeLocalStorage } from './safeLocalStorage';

export type Plan = { goal: string; steps: Array<{ name: string; tool: string; inputs?: any }> };
export type Run = { id: string; status: string; created_at?: string; plan?: Plan };
export type Project = { id: string; name: string; repo_url?: string|null; local_path?: string|null; workspace_mode?: string; default_branch?: string|null };

function currentProjectId(): string | undefined {
  return safeLocalStorage.getItem('projectId') || undefined;
}

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const projectId = currentProjectId();
  const headers = new Headers(init?.headers || {});
  if (projectId) headers.set('x-project-id', projectId);

  // Add auth token if available
  const session = await auth.getSession();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Add base URL if needed
  let fetchUrl: RequestInfo = input;
  if (typeof input === 'string') {
    fetchUrl = apiBase ? `${apiBase}${input}` : input;
  }

  const url = typeof fetchUrl === 'string' ? fetchUrl : fetchUrl.url;
  // Debug: console.log(`[API] Making request to: ${url}`, { method: init?.method || 'GET', projectId });

  try {
    const response = await fetch(fetchUrl, {
      ...init,
      headers,
      credentials: 'include' // Include cookies for auth
    });

    // Debug: console.log(`[API] Response from ${url}:`, { status: response.status });

    // Handle authentication errors
    if (response.status === 401) {
      console.error('[API] Authentication error - clearing auth and staying in React app');

      // Clear any stored auth data (using safe wrapper)
      safeLocalStorage.removeItem('auth_session');
      safeLocalStorage.removeItem('sb-access-token');
      safeLocalStorage.removeItem('authenticated');

      // For React SPA, don't redirect to external pages
      // The AuthCheck component will handle showing the login form
      throw new Error('Authentication required');
    }

    // Handle server errors with detailed logging
    if (response.status >= 500) {
      const errorText = await response.clone().text();
      console.error(`[API] Server error ${response.status} from ${url}:`, errorText);
      throw new Error(`Server error ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
    }

    return response;
  } catch (error) {
    console.error(`[API] Request failed for ${url}:`, error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error - API server may be down');
    }
    throw error;
  }
}
export type Event = { id?: string; type: string; created_at?: string; payload?: any };

export async function listRuns(limit = 50): Promise<Run[]> {
  const pid = currentProjectId();
  const url = `/runs?limit=${encodeURIComponent(String(limit))}${pid?`&projectId=${encodeURIComponent(pid)}`:''}`;
  // Debug: console.log('[API] listRuns: Fetching runs from:', url);

  try {
    const rsp = await apiFetch(url);
    // Debug: console.log('[API] listRuns: Response status:', rsp.status);

    if (!rsp.ok) {
      const errorText = await rsp.text();
      console.error('[API] listRuns: Failed response:', { status: rsp.status, statusText: rsp.statusText, body: errorText });
      throw new Error(`Failed to fetch runs: ${rsp.status} ${rsp.statusText}${errorText ? ' - ' + errorText : ''}`);
    }

    const data = await rsp.json();
    // Debug: console.log('[API] listRuns: Response data:', data);

    if (!data || typeof data !== 'object') {
      console.error('[API] listRuns: Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }

    const runs = Array.isArray(data?.runs) ? data.runs : [];
    // Debug: console.log('[API] listRuns: Returning', runs.length, 'runs');
    return runs;
  } catch (error) {
    console.error('[API] listRuns: Error:', error);
    throw error;
  }
}
export async function getRun(id: string){
  const rsp = await apiFetch(`/runs/${encodeURIComponent(id)}`);
  if (!rsp.ok) throw new Error('not found');
  return rsp.json();
}
export async function getTimeline(id: string): Promise<Event[]>{
  const rsp = await apiFetch(`/runs/${encodeURIComponent(id)}/timeline`);
  if (!rsp.ok) return [];
  return rsp.json();
}

export async function listProjects(): Promise<Project[]> {
  const rsp = await apiFetch('/projects');
  if (!rsp.ok) return [];
  const j = await rsp.json();
  return j.projects || [];
}
export async function createProject(p: Partial<Project>): Promise<Project | null> {
  const rsp = await apiFetch('/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p) });
  if (!rsp.ok) return null;
  return rsp.json();
}

export async function createRun(plan: Plan): Promise<{ id: string; status: string } | null> {
  const rsp = await apiFetch('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });
  if (!rsp.ok) return null;
  return rsp.json();
}
