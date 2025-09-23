import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

export interface TimelineEvent {
  sequence: number;
  type: string;
  occurredAt: string;
}

export interface TimelineTableProps {
  events: TimelineEvent[];
}

export function TimelineTable({ events }: TimelineTableProps) {
  if (!events.length) {
    return <Typography color="text.secondary">No events recorded.</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>Timestamp</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.sequence}>
              <TableCell>{event.sequence}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{event.type}</TableCell>
              <TableCell>{new Date(event.occurredAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default TimelineTable;
