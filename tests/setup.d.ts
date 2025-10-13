declare global {
  var testUtils: {
    cleanDatabase(): Promise<void>;
    generateTestData(): {
      id: string;
      timestamp: string;
      random: number;
    };
    waitFor(
      condition: () => boolean | Promise<boolean>,
      timeoutMs?: number,
      intervalMs?: number
    ): Promise<void>;
    flushPromises(): Promise<void>;
  };

  var mockStorageMap: Map<string, Buffer>;
  var __NOFX_TEST_POOLS__: Set<any>;
}

export {};
