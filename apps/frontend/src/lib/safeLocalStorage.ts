/**
 * Safe LocalStorage Wrapper
 *
 * Prevents QuotaExceededError by gracefully handling storage limits.
 * Prevents crashes from SecurityError in private browsing mode.
 *
 * Usage:
 *   import { safeLocalStorage } from '@/lib/safeLocalStorage';
 *   safeLocalStorage.setItem('key', 'value');
 */

interface StorageQuotaInfo {
  used: number;
  total: number;
  available: number;
  percentUsed: number;
}

class SafeLocalStorage {
  private isAvailable: boolean;
  private namespace: string;

  constructor(namespace: string = 'app') {
    this.namespace = namespace;
    this.isAvailable = this.checkAvailability();
  }

  /**
   * Check if localStorage is available
   * (can be disabled in private browsing, etc.)
   */
  private checkAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage is not available:', e);
      return false;
    }
  }

  /**
   * Get storage quota information (if supported)
   */
  async getQuotaInfo(): Promise<StorageQuotaInfo | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const total = estimate.quota || 0;
        return {
          used,
          total,
          available: total - used,
          percentUsed: (used / total) * 100
        };
      } catch (e) {
        console.warn('Could not get storage quota:', e);
      }
    }
    return null;
  }

  /**
   * Safely set item in localStorage
   * Handles QuotaExceededError by clearing old data
   */
  setItem(key: string, value: string, options: { clearOnQuotaExceeded?: boolean } = {}): boolean {
    if (!this.isAvailable) {
      console.warn('localStorage not available, skipping setItem');
      return false;
    }

    const fullKey = `${this.namespace}:${key}`;

    try {
      localStorage.setItem(fullKey, value);
      return true;
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded');

        if (options.clearOnQuotaExceeded !== false) {
          // Try to clear old items and retry
          this.clearOldItems();

          try {
            localStorage.setItem(fullKey, value);
            console.info('Successfully set item after clearing old data');
            return true;
          } catch (retryError) {
            console.error('Failed to set item even after clearing:', retryError);
            return false;
          }
        }
      } else {
        console.error('Error setting localStorage item:', e);
      }
      return false;
    }
  }

  /**
   * Safely get item from localStorage
   */
  getItem(key: string): string | null {
    if (!this.isAvailable) {
      return null;
    }

    const fullKey = `${this.namespace}:${key}`;

    try {
      return localStorage.getItem(fullKey);
    } catch (e) {
      console.error('Error getting localStorage item:', e);
      return null;
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    if (!this.isAvailable) {
      return false;
    }

    const fullKey = `${this.namespace}:${key}`;

    try {
      localStorage.removeItem(fullKey);
      return true;
    } catch (e) {
      console.error('Error removing localStorage item:', e);
      return false;
    }
  }

  /**
   * Clear all items for this namespace
   */
  clear(): boolean {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const keys = Object.keys(localStorage);
      const namespacePrefix = `${this.namespace}:`;

      keys.forEach(key => {
        if (key.startsWith(namespacePrefix)) {
          localStorage.removeItem(key);
        }
      });

      return true;
    } catch (e) {
      console.error('Error clearing localStorage:', e);
      return false;
    }
  }

  /**
   * Clear old items based on timestamp metadata
   * (requires storing items with timestamp)
   */
  private clearOldItems(): void {
    try {
      const keys = Object.keys(localStorage);
      const namespacePrefix = `${this.namespace}:`;
      const itemsWithTimestamp: Array<{ key: string; timestamp: number }> = [];

      // Collect items with timestamps
      keys.forEach(key => {
        if (key.startsWith(namespacePrefix)) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              const parsed = JSON.parse(value);
              if (parsed._timestamp) {
                itemsWithTimestamp.push({
                  key,
                  timestamp: parsed._timestamp
                });
              }
            }
          } catch {
            // Not JSON or no timestamp, skip
          }
        }
      });

      // Sort by timestamp (oldest first)
      itemsWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of items
      const numToRemove = Math.ceil(itemsWithTimestamp.length * 0.25);
      for (let i = 0; i < numToRemove; i++) {
        localStorage.removeItem(itemsWithTimestamp[i].key);
      }

      console.info(`Cleared ${numToRemove} old localStorage items`);
    } catch (e) {
      console.error('Error clearing old items:', e);
      // Fallback: clear everything in namespace
      this.clear();
    }
  }

  /**
   * Set JSON object (with automatic timestamp)
   */
  setJSON<T>(key: string, value: T): boolean {
    const wrapped = {
      ...value,
      _timestamp: Date.now()
    };
    return this.setItem(key, JSON.stringify(wrapped));
  }

  /**
   * Get JSON object (strips timestamp)
   */
  getJSON<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      // Remove internal timestamp before returning
      if (parsed._timestamp) {
        delete parsed._timestamp;
      }
      return parsed as T;
    } catch (e) {
      console.error('Error parsing JSON from localStorage:', e);
      return null;
    }
  }

  /**
   * Check if storage is getting full (> 80% used)
   */
  async isNearQuota(): Promise<boolean> {
    const info = await this.getQuotaInfo();
    if (!info) return false;
    return info.percentUsed > 80;
  }
}

// Export singleton instance
export const safeLocalStorage = new SafeLocalStorage('nofx');

// Export class for custom namespaces
export { SafeLocalStorage };

// Convenience exports that match localStorage API
export const setItem = (key: string, value: string) => safeLocalStorage.setItem(key, value);
export const getItem = (key: string) => safeLocalStorage.getItem(key);
export const removeItem = (key: string) => safeLocalStorage.removeItem(key);
export const clear = () => safeLocalStorage.clear();
