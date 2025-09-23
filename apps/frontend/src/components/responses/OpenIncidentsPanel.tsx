import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import StatusChip from '../StatusChip';
import type { IncidentSummary } from '../../lib/responses';
import { formatDateTime } from '../../pages/responses/formatters';

export interface OpenIncidentsPanelProps {
  incidents: IncidentSummary[];
}

export function OpenIncidentsPanel({ incidents }: OpenIncidentsPanelProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>Open Incidents</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Track incidents that require operator review and potential rollback.
      </Typography>
      {incidents.length ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Run</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Observed</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/responses/${encodeURIComponent(incident.runId)}`}>
                      {incident.runId}
                    </Link>
                  </TableCell>
                  <TableCell>{incident.type}</TableCell>
                  <TableCell>{formatDateTime(incident.occurredAt)}</TableCell>
                  <TableCell><StatusChip status={incident.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary">
          All incidents are resolved.
        </Typography>
      )}
    </Paper>
  );
}

export default OpenIncidentsPanel;
