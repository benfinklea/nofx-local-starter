import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface RequestLog {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  latency?: number;
  error?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
}

class RequestLoggerService {
  private logs: RequestLog[] = [];
  private listeners: ((logs: RequestLog[]) => void)[] = [];
  private maxLogs = 100;

  log(entry: Omit<RequestLog, 'id' | 'timestamp'>) {
    const logEntry: RequestLog = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.listeners.forEach(listener => listener([...this.logs]));
  }

  subscribe(listener: (logs: RequestLog[]) => void) {
    this.listeners.push(listener);
    listener([...this.logs]);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
  }

  getLogs() {
    return [...this.logs];
  }
}

export const requestLogger = new RequestLoggerService();

// Patch fetch to automatically log requests
const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';
  const startTime = Date.now();

  const logEntry: Partial<RequestLog> = {
    method,
    url,
    requestHeaders: init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : undefined,
    requestBody: init?.body ? (typeof init.body === 'string' ? init.body : '[Binary Data]') : undefined
  };

  try {
    const response = await originalFetch(input, init);
    const endTime = Date.now();

    requestLogger.log({
      ...logEntry,
      status: response.status,
      statusText: response.statusText,
      latency: endTime - startTime,
      responseHeaders: Object.fromEntries(response.headers.entries())
    });

    return response;
  } catch (error) {
    const endTime = Date.now();

    requestLogger.log({
      ...logEntry,
      latency: endTime - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
};

export default function RequestLogger({ compact = false }: { compact?: boolean }) {
  const [logs, setLogs] = React.useState<RequestLog[]>([]);
  const [expanded, setExpanded] = React.useState<string | false>(false);

  React.useEffect(() => {
    return requestLogger.subscribe(setLogs);
  }, []);

  function getStatusChip(status?: number, error?: string) {
    if (error) {
      return <Chip label="Error" color="error" size="small" />;
    }
    if (!status) {
      return <Chip label="Pending" color="default" size="small" />;
    }
    if (status >= 200 && status < 300) {
      return <Chip label={status} color="success" size="small" />;
    }
    if (status >= 400) {
      return <Chip label={status} color="error" size="small" />;
    }
    return <Chip label={status} color="warning" size="small" />;
  }

  function handleAccordionChange(panel: string) {
    return (_: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };
  }

  if (compact) {
    const recentErrors = logs.filter(log => log.error || (log.status && log.status >= 400)).slice(0, 3);
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Recent Requests ({logs.length})
        </Typography>
        {recentErrors.length > 0 ? (
          <Box display="flex" gap={1} flexWrap="wrap">
            {recentErrors.map(log => (
              <Chip
                key={log.id}
                label={`${log.method} ${log.url.split('/').pop()} - ${log.error || log.status}`}
                color="error"
                size="small"
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recent errors
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">
          Request Log ({logs.length})
        </Typography>
        <Button size="small" onClick={() => requestLogger.clear()}>
          Clear
        </Button>
      </Box>

      <TableContainer sx={{ maxHeight: 400 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Latency</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>
                  <Box component="span" sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {log.timestamp.toLocaleTimeString()}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={log.method} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {log.url}
                </TableCell>
                <TableCell>
                  {getStatusChip(log.status, log.error)}
                </TableCell>
                <TableCell>
                  {log.latency ? `${log.latency}ms` : '-'}
                </TableCell>
                <TableCell>
                  <Accordion
                    expanded={expanded === log.id}
                    onChange={handleAccordionChange(log.id)}
                    sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 0, '& .MuiAccordionSummary-content': { margin: 0 } }}>
                      <Typography variant="body2">View</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      {log.error && (
                        <Typography variant="body2" color="error" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                          Error: {log.error}
                        </Typography>
                      )}
                      {log.requestHeaders && (
                        <Box mb={1}>
                          <Typography variant="subtitle2">Request Headers:</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {JSON.stringify(log.requestHeaders, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {log.responseHeaders && (
                        <Box mb={1}>
                          <Typography variant="subtitle2">Response Headers:</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {JSON.stringify(log.responseHeaders, null, 2)}
                          </Typography>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}