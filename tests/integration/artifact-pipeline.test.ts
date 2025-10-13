/**
 * Integration test for artifact storage pipeline
 *
 * This test verifies the complete flow:
 * 1. Create a test file artifact
 * 2. Save it using saveArtifact()
 * 3. Retrieve it via the API endpoint
 * 4. Verify the content matches
 */

import { saveArtifact } from '../../src/lib/artifacts';
import { store } from '../../src/lib/store';
import { app } from '../../src/api/main';
import request from 'supertest';
import crypto from 'node:crypto';

describe('Artifact Storage Pipeline', () => {
  const testContent = 'Soft threads weave\nThrough woven comfort and warmth\nSweatshirts embrace cold';
  const artifactName = 'test-haiku.txt';

  let artifactPath: string;
  let testRunId: string;
  let testStepId: string;

  beforeAll(async () => {
    // Clear any previous mock storage to ensure clean state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((global as any).mockStorageMap) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).mockStorageMap.clear();
    }
    // Ensure test run and step exist in the store
    const run = await store.createRun({
      goal: 'Test artifact storage',
      steps: [{ name: 'test step', tool: 'test' }]
    });
    testRunId = run.id;

    const step = await store.createStep(testRunId, 'test step', 'test', {});
    if (!step) {
      throw new Error('Failed to create test step');
    }
    testStepId = step.id;
  });

  it('should save artifact to storage', async () => {
    // Step 1: Save the artifact
    artifactPath = await saveArtifact(testRunId, testStepId, artifactName, testContent);

    expect(artifactPath).toBeTruthy();
    expect(artifactPath).toContain(testRunId);
    expect(artifactPath).toContain(testStepId);
    expect(artifactPath).toContain(artifactName);
  });

  it('should record artifact metadata in database', async () => {
    // Step 2: Verify artifact is recorded in the store
    const artifacts = await store.listArtifactsByRun(testRunId);

    expect(artifacts.length).toBeGreaterThan(0);

    const artifact = artifacts.find(a => a.path === artifactPath);
    expect(artifact).toBeDefined();
    expect(artifact?.type).toBe('text/plain');
    expect(artifact?.metadata).toBeDefined();

    // Verify SHA256 hash matches
    const expectedHash = crypto.createHash('sha256').update(testContent).digest('hex');
    const metadata = artifact?.metadata as { sha256?: string };
    expect(metadata?.sha256).toBe(expectedHash);
  });

  it('should retrieve artifact content via API endpoint', async () => {
    // Step 3: Retrieve via API
    const response = await request(app)
      .get(`/artifacts/${artifactPath}`)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.content).toBe(testContent);
    expect(response.body.path).toBe(artifactPath);
    expect(response.body.size).toBe(testContent.length);
  });

  it('should handle non-existent artifacts gracefully', async () => {
    const fakePath = 'runs/fake/steps/fake/fake.txt';

    const response = await request(app)
      .get(`/artifacts/${fakePath}`)
      .expect(404);

    expect(response.body.error).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup: Test data will be removed when clearing the test database
    // No explicit cleanup needed as we're using filesystem store in test environment
  });
});
