/**
 * Factory for creating store drivers based on configuration
 */

import { FileSystemStore } from './FileSystemStore';
import { DatabaseStore } from './DatabaseStore';
import type { StoreDriver } from './types';

function getDataDriver(): string {
  return (process.env.DATA_DRIVER || (process.env.QUEUE_DRIVER === 'memory' ? 'fs' : 'db')).toLowerCase();
}

export class StoreFactory {
  private static instance: StoreDriver | null = null;

  static getInstance(): StoreDriver {
    if (!this.instance) {
      this.instance = this.createStore();
    }
    return this.instance;
  }

  private static createStore(): StoreDriver {
    const driver = getDataDriver();
    switch (driver) {
      case 'fs':
        return new FileSystemStore();
      case 'db':
        return new DatabaseStore();
      default:
        throw new Error(`Unknown data driver: '${driver}'. Supported drivers: 'fs', 'db'. Set DATA_DRIVER environment variable or ensure QUEUE_DRIVER is properly configured.`);
    }
  }

  static get driver(): string {
    return getDataDriver();
  }

  // For testing: reset the singleton
  static reset(): void {
    this.instance = null;
  }
}