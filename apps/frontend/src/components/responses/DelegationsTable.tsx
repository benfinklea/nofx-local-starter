import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import StatusChip from '../StatusChip';

export interface DelegationRow {
  callId: string;
  toolName: string;
  status: string;
  requestedAt: string;
  completedAt?: string;
}

export interface DelegationsTableProps {
  rows: DelegationRow[];
}

export function DelegationsTable({ rows }: DelegationsTableProps) {
  if (!rows.length) {
    return <Typography color="text.secondary">No delegations recorded.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Tool</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Requested</TableCell>
          <TableCell>Completed</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.callId}>
            <TableCell>{row.toolName}</TableCell>
            <TableCell><StatusChip status={row.status} /></TableCell>
            <TableCell>{new Date(row.requestedAt).toLocaleString()}</TableCell>
            <TableCell>{row.completedAt ? new Date(row.completedAt).toLocaleString() : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default DelegationsTable;
