/**
 * Supabase Client for Browser (Client Components)
 * Uses @supabase/ssr for modern authentication patterns
 */

import { createBrowserClient as createClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

/**
 * Create a Supabase client for use in browser/client components
 * This client automatically handles:
 * - Cookie-based session storage
 * - Automatic token refresh
 * - Auth state changes
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Read from document.cookie
        const cookies = document.cookie.split('; ');
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        return cookie?.split('=')[1];
      },
      set(name: string, value: string, options: any) {
        // Write to document.cookie
        let cookie = `${name}=${value}`;
        if (options?.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        if (options?.path) {
          cookie += `; path=${options.path}`;
        }
        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options?.sameSite) {
          cookie += `; samesite=${options.sameSite}`;
        }
        if (options?.secure) {
          cookie += '; secure';
        }
        document.cookie = cookie;
      },
      remove(name: string, options: any) {
        // Remove by setting max-age=0
        let cookie = `${name}=; max-age=0`;
        if (options?.path) {
          cookie += `; path=${options.path}`;
        }
        document.cookie = cookie;
      }
    }
  });
}

// Export singleton instance for convenience
export const supabase = createBrowserClient();