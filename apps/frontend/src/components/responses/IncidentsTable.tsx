import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import StatusChip from '../StatusChip';

export interface IncidentRow {
  id: string;
  status: string;
  type: string;
  occurredAt: string;
}

export interface IncidentsTableProps {
  rows: IncidentRow[];
}

export function IncidentsTable({ rows }: IncidentsTableProps) {
  if (!rows.length) {
    return <Typography color="text.secondary">No incidents associated with this run.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Status</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Observed</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell><StatusChip status={row.status} /></TableCell>
            <TableCell>{row.type}</TableCell>
            <TableCell>{new Date(row.occurredAt).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default IncidentsTable;
