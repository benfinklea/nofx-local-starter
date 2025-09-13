declare global {
  var testUtils: {
    cleanDatabase(): Promise<void>;
    generateTestData(): {
      id: string;
      timestamp: string;
      random: number;
    };
  };
}

export {};