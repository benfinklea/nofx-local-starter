import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import type { RateLimitSnapshot, TenantRateLimitSummary } from '../../lib/responses';
import { formatRemaining, formatPercent, formatTime } from '../../pages/responses/formatters';

export interface RateLimitPanelProps {
  lastSnapshot?: RateLimitSnapshot;
  tenants: TenantRateLimitSummary[];
}

export function RateLimitPanel({ lastSnapshot, tenants }: RateLimitPanelProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>Rate Limit Watch</Typography>
      {lastSnapshot ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Last snapshot · Requests {formatRemaining(lastSnapshot.remainingRequests, lastSnapshot.limitRequests)} · Tokens {formatRemaining(lastSnapshot.remainingTokens, lastSnapshot.limitTokens)} · Observed {formatTime(lastSnapshot.observedAt)}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No rate limit snapshots captured yet.
        </Typography>
      )}
      {tenants.length ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Requests Remaining</TableCell>
                <TableCell>Tokens Remaining</TableCell>
                <TableCell>Observed</TableCell>
                <TableCell>Avg Proc</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((tenant) => {
                const latest = tenant.latest;
                const status = tenant.alert
                  ? { color: tenant.alert === 'requests' ? 'warning' : 'error', label: tenant.alert === 'requests' ? 'Requests low' : 'Tokens low' }
                  : { color: 'success' as const, label: 'Healthy' };
                return (
                  <TableRow key={tenant.tenantId}>
                    <TableCell>{tenant.tenantId}</TableCell>
                    <TableCell>
                      <Tooltip title={latest ? formatRemaining(latest.remainingRequests, latest.limitRequests) : '—'}>
                        <span>{formatPercent(tenant.remainingRequestsPct)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={latest ? formatRemaining(latest.remainingTokens, latest.limitTokens) : '—'}>
                        <span>{formatPercent(tenant.remainingTokensPct)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{latest ? formatTime(latest.observedAt) : '—'}</TableCell>
                    <TableCell>{tenant.averageProcessingMs ? `${Math.round(tenant.averageProcessingMs)} ms` : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" color={status.color} variant={status.color === 'success' ? 'outlined' : 'filled'} label={status.label} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary">
            No tenant rate limit telemetry recorded.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default RateLimitPanel;
