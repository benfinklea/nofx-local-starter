/**
 * Mock Supabase Client Builder
 * Creates properly structured mocks that prevent test regression
 */

export interface MockSupabaseChain {
  select: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  _mockChain: MockSupabaseChain;
}

/**
 * Creates a mock Supabase client with proper chaining structure
 * This prevents regression by ensuring each call returns a new mock instance
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  // Create the chain mocks
  const mockSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  const mockEq = jest.fn(() => ({
    single: mockSingle,
    then: (resolve: any) => mockSingle().then(resolve)
  }));
  const mockSelect = jest.fn(() => ({
    eq: mockEq
  }));
  const mockUpdate = jest.fn(() => ({
    eq: mockEq
  }));
  const mockDelete = jest.fn(() => ({
    eq: mockEq
  }));
  const mockUpsert = jest.fn(() => Promise.resolve({ data: null, error: null }));

  // Create the from mock that returns fresh chain for each call
  const mockFrom = jest.fn((table: string) => ({
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
    delete: mockDelete
  }));

  return {
    from: mockFrom,
    _mockChain: {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete
    }
  };
}

/**
 * Reset all mocks in a Supabase client
 */
export function resetMockSupabaseClient(client: MockSupabaseClient): void {
  client.from.mockClear();
  client._mockChain.select.mockClear();
  client._mockChain.eq.mockClear();
  client._mockChain.single.mockClear();
  client._mockChain.upsert.mockClear();
  client._mockChain.update.mockClear();
  client._mockChain.delete.mockClear();
}

/**
 * Configure mock responses for common patterns
 */
export class MockSupabaseBuilder {
  constructor(private client: MockSupabaseClient) {}

  /**
   * Mock a successful select().eq().single() query
   */
  mockSelectSingle(data: any): this {
    this.client._mockChain.single.mockResolvedValueOnce({ data, error: null });
    return this;
  }

  /**
   * Mock a failed select().eq().single() query
   */
  mockSelectSingleError(error: Error): this {
    this.client._mockChain.single.mockResolvedValueOnce({ data: null, error });
    return this;
  }

  /**
   * Mock a successful upsert
   */
  mockUpsertSuccess(data?: any): this {
    this.client._mockChain.upsert.mockResolvedValueOnce({ data: data || null, error: null });
    return this;
  }

  /**
   * Mock a failed upsert
   */
  mockUpsertError(error: Error): this {
    this.client._mockChain.upsert.mockResolvedValueOnce({ data: null, error });
    return this;
  }

  /**
   * Mock a successful update().eq() query
   */
  mockUpdateSuccess(data?: any): this {
    this.client._mockChain.eq.mockResolvedValueOnce({ data: data || null, error: null });
    return this;
  }

  /**
   * Mock a failed update().eq() query
   */
  mockUpdateError(error: Error): this {
    this.client._mockChain.eq.mockResolvedValueOnce({ data: null, error });
    return this;
  }

  /**
   * Mock a successful delete().eq() query
   */
  mockDeleteSuccess(): this {
    this.client._mockChain.eq.mockResolvedValueOnce({ data: null, error: null });
    return this;
  }

  /**
   * Mock a failed delete().eq() query
   */
  mockDeleteError(error: Error): this {
    this.client._mockChain.eq.mockResolvedValueOnce({ data: null, error });
    return this;
  }

  /**
   * Get the underlying client
   */
  build(): MockSupabaseClient {
    return this.client;
  }
}

/**
 * Create a builder for fluent mock configuration
 */
export function mockSupabase(client: MockSupabaseClient): MockSupabaseBuilder {
  return new MockSupabaseBuilder(client);
}
