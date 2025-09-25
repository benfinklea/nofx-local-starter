import healthHandler from '../../api/health';
import { callHandler } from './utils/testHelpers';

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const response = await callHandler(healthHandler, {
      method: 'GET',
      authenticated: false,
    });

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      environment: expect.any(String),
      node_version: expect.any(String),
    });
  });

  it('should reject non-GET requests', async () => {
    const response = await callHandler(healthHandler, {
      method: 'POST',
      authenticated: false,
    });

    expect(response.status).toBe(405);
    expect(response.json).toEqual({ error: 'Method not allowed' });
  });

  it('should work without authentication', async () => {
    const response = await callHandler(healthHandler, {
      method: 'GET',
      authenticated: false,
    });

    expect(response.status).toBe(200);
  });
});