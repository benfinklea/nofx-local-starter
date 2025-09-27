import * as React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResponsesRunDetail from './ResponsesRunDetail';
import { AppTheme } from '../../theme';
import * as responsesApi from '../../lib/responses';

jest.mock('../../lib/responses');
const mockedResponsesApi = jest.mocked(responsesApi);

const sampleDetail = {
  run: {
    runId: 'run-123',
    status: 'completed',
    model: 'gpt-4o-mini',
    createdAt: new Date('2024-08-20T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-08-20T10:05:00Z').toISOString(),
    metadata: { tenant_id: 'tenant-a', region: 'us-east' },
    traceId: 'trace-abc',
    safety: {
      hashedIdentifier: 'redacted:abc',
      refusalCount: 1,
      moderatorNotes: [
        { reviewer: 'Alice', note: 'Looks good', disposition: 'approved', recordedAt: new Date('2024-08-20T10:04:00Z').toISOString() },
      ],
    },
  },
  events: [
    { sequence: 1, type: 'response.created', payload: { request: '...' }, occurredAt: new Date('2024-08-20T10:00:01Z').toISOString() },
    { sequence: 2, type: 'response.completed', payload: { output: 'done' }, occurredAt: new Date('2024-08-20T10:00:05Z').toISOString() },
  ],
  bufferedMessages: [{ id: 'msg-1', text: 'Hello world' }],
  reasoning: ['Model reasoned about the input.'],
  refusals: [],
  outputAudio: [{ itemId: 'audio-1', audioBase64: 'UklGRhYAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=', format: 'wav', transcript: 'Hi there' }],
  outputImages: [{ itemId: 'image-1', b64JSON: '', imageUrl: 'https://example.com/image.png', background: 'transparent', size: '1024x1024' }],
  inputTranscripts: [{ itemId: 'input-1', transcript: 'User said hello' }],
  delegations: [
    { callId: 'call-1', toolName: 'search_docs', status: 'completed', requestedAt: new Date('2024-08-20T10:00:02Z').toISOString(), completedAt: new Date('2024-08-20T10:00:03Z').toISOString(), output: { result: 42 } },
  ],
  incidents: [
    { id: 'incident-1', status: 'resolved', type: 'retry', occurredAt: new Date('2024-08-20T10:00:04Z').toISOString() },
  ],
};

function renderWithRouter(path: string) {
  return render(
    <AppTheme>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/responses/:id" element={<ResponsesRunDetail />} />
        </Routes>
      </MemoryRouter>
    </AppTheme>,
  );
}

describe('ResponsesRunDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResponsesApi.getResponsesRun.mockResolvedValue(sampleDetail as any);
    mockedResponsesApi.retryResponsesRun.mockResolvedValue({ runId: 'run-123' } as any);
    mockedResponsesApi.addModeratorNote.mockResolvedValue({} as any);
    mockedResponsesApi.logUiEvent.mockResolvedValue(undefined);
  });

  it('renders the responses run timeline and metadata', async () => {
    renderWithRouter('/responses/run-123');

    await waitFor(() => expect(screen.getByText('Responses Run run-123')).toBeInTheDocument());

    expect(screen.getByText(/Model:/)).toHaveTextContent('gpt-4o-mini');
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('search_docs')).toBeInTheDocument();
    expect(screen.getByText('User said hello')).toBeInTheDocument();
    expect(screen.getByText('retry')).toBeInTheDocument();

    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
  });

  it('allows retrying the run', async () => {
    renderWithRouter('/responses/run-123');
    await screen.findByText('Responses Run run-123');
    const button = screen.getByRole('button', { name: /retry run/i });
    fireEvent.click(button);
    await waitFor(() => expect(mockedResponsesApi.retryResponsesRun).toHaveBeenCalledWith('run-123'));
  });
});
