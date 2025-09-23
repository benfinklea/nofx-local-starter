import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResponsesDashboard from './ResponsesDashboard';
import { AppTheme } from '../../theme';
import * as responsesApi from '../../lib/responses';

vi.mock('../../lib/responses');
const mockedResponsesApi = vi.mocked(responsesApi);

const runs = [
  {
    runId: 'resp-1',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { tenant_id: 'tenant-a' },
    safety: { refusalCount: 2, moderatorNotes: [] },
  },
];

const summary = {
  totalRuns: 10,
  failuresLast24h: 3,
  statusCounts: { completed: 9, failed: 1 },
  lastRunAt: new Date().toISOString(),
  totalEstimatedCost: 12.34,
  totalTokens: 1000,
  averageTokensPerRun: 100,
  totalRefusals: 2,
  lastRateLimits: {
    limitRequests: 1000,
    remainingRequests: 900,
    limitTokens: 2000,
    remainingTokens: 1500,
    resetRequestsSeconds: 10,
    resetTokensSeconds: 20,
    processingMs: 120,
    requestId: 'req-1',
    tenantId: 'tenant-a',
    observedAt: new Date().toISOString(),
  },
  recentRuns: [
    {
      runId: 'resp-1',
      status: 'completed',
      model: 'gpt-4o-mini',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      traceId: 'trace-1',
      tenantId: 'tenant-a',
      refusalCount: 2,
    },
  ],
  rateLimitTenants: [
    {
      tenantId: 'tenant-a',
      averageProcessingMs: 120,
      remainingRequestsPct: 0.9,
      remainingTokensPct: 0.05,
      alert: 'tokens',
      latest: {
        limitRequests: 1000,
        remainingRequests: 900,
        resetRequestsSeconds: 10,
        limitTokens: 2000,
        remainingTokens: 100,
        resetTokensSeconds: 20,
        processingMs: 120,
        requestId: 'req-1',
        tenantId: 'tenant-a',
        observedAt: new Date().toISOString(),
      },
    },
  ],
  openIncidents: 1,
  incidentDetails: [
    {
      id: 'inc-1',
      runId: 'resp-1',
      type: 'retry',
      status: 'open',
      sequence: 5,
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-a',
    },
  ],
  tenantRollup: [
    {
      tenantId: 'tenant-a',
      runCount: 6,
      totalTokens: 600,
      averageTokensPerRun: 100,
      refusalCount: 1,
      lastRunAt: new Date().toISOString(),
      estimatedCost: 6.12,
      regions: ['us-east'],
    },
    {
      tenantId: 'tenant-b',
      runCount: 4,
      totalTokens: 400,
      averageTokensPerRun: 100,
      refusalCount: 1,
      lastRunAt: new Date().toISOString(),
      estimatedCost: 6.22,
      regions: ['eu-west'],
    },
  ],
};

function renderPage() {
  return render(
    <AppTheme>
      <MemoryRouter initialEntries={['/responses']}>
        <Routes>
          <Route path="/responses" element={<ResponsesDashboard />} />
        </Routes>
      </MemoryRouter>
    </AppTheme>,
  );
}

describe('ResponsesDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResponsesApi.listResponsesRuns.mockResolvedValue(runs as any);
    mockedResponsesApi.getResponsesSummary.mockResolvedValue(summary as any);
    mockedResponsesApi.logUiEvent.mockResolvedValue(undefined);
  });

  it('renders summary metrics and run table', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Responses Archive')).toBeInTheDocument());
    expect(screen.getByText(/Total Runs/i)).toBeInTheDocument();
    expect(screen.getByText(/Failures \(24h\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Open Incidents/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Runs: 1/)).toBeInTheDocument();
    expect(screen.getByText('Tokens low')).toBeInTheDocument();
    expect(screen.getByText('retry')).toBeInTheDocument();
    const runRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByRole('link', { name: 'resp-1' }) && within(row).queryByText('tenant-a'));
    expect(runRow).toBeTruthy();
    if (!runRow) return;
    expect(within(runRow).getByText((text) => text.trim() === '2')).toBeInTheDocument();
    expect(mockedResponsesApi.logUiEvent).toHaveBeenCalledWith(expect.objectContaining({ source: 'responses-dashboard', intent: 'view' }));
  });

  it('handles missing summary data gracefully', async () => {
    mockedResponsesApi.getResponsesSummary.mockResolvedValueOnce({
      totalRuns: 0,
      statusCounts: {},
      failuresLast24h: 0,
      totalEstimatedCost: 0,
      totalTokens: 0,
      averageTokensPerRun: 0,
      totalRefusals: 0,
      rateLimitTenants: [],
      tenantRollup: [],
      incidentDetails: [],
      recentRuns: [],
      openIncidents: 0,
    } as any);

    renderPage();

    await waitFor(() => expect(screen.getByText('Responses Archive')).toBeInTheDocument());
    expect(screen.getByText(/Total Runs/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate Limit Watch/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Open Incidents/i).length).toBeGreaterThanOrEqual(2);
  });
});
