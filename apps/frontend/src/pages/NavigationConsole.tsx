import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  TextField,
  InputAdornment,
  Tooltip,
  LinearProgress,
  Badge,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import type { NavigationEntry, NavigationManifest } from '../../../shared/types/navigation-manifest';
import HelpText from '../components/HelpText';

// Mock manifest loader (replace with actual API call)
const loadManifest = async (): Promise<NavigationManifest> => {
  try {
    const response = await fetch('/api/navigation/manifest');
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.warn('Failed to load navigation manifest from API');
  }

  // Return empty manifest as fallback
  return {
    version: '1.0.0',
    entries: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      totalEntries: 0
    }
  };
};

// Health check for navigation entries
const checkEntryHealth = async (entry: NavigationEntry): Promise<{
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
  responseTime?: number;
}> => {
  const startTime = Date.now();
  try {
    // Check if route exists
    const response = await fetch(entry.path, { method: 'HEAD' });
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return { status: 'healthy', responseTime };
    } else if (response.status === 403) {
      return { status: 'degraded', message: 'Permission required', responseTime };
    } else {
      return { status: 'unavailable', message: `HTTP ${response.status}`, responseTime };
    }
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
};

interface EntryRowProps {
  entry: NavigationEntry;
  healthStatus: { status: string; message?: string; responseTime?: number } | null;
}

function EntryRow({ entry, healthStatus }: EntryRowProps) {
  const [open, setOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stable': return 'success';
      case 'beta': return 'info';
      case 'alpha': return 'warning';
      case 'experimental': return 'warning';
      case 'deprecated': return 'error';
      default: return 'default';
    }
  };

  const getHealthIcon = () => {
    if (!healthStatus) return <InfoIcon color="disabled" />;
    switch (healthStatus.status) {
      case 'healthy': return <CheckCircleIcon color="success" />;
      case 'degraded': return <WarningIcon color="warning" />;
      case 'unavailable': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="disabled" />;
    }
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Box display="flex" alignItems="center" gap={1}>
            {entry.label}
            {entry.badge && (
              <Chip label={entry.badge} size="small" color="primary" variant="outlined" />
            )}
          </Box>
        </TableCell>
        <TableCell>{entry.path}</TableCell>
        <TableCell>
          <Chip
            label={entry.status}
            size="small"
            color={getStatusColor(entry.status) as any}
          />
        </TableCell>
        <TableCell>{entry.group}</TableCell>
        <TableCell>
          <Tooltip title={healthStatus?.message || 'Health status'}>
            <Box display="flex" alignItems="center" gap={0.5}>
              {getHealthIcon()}
              {healthStatus?.responseTime && (
                <Typography variant="caption" color="textSecondary">
                  {healthStatus.responseTime}ms
                </Typography>
              )}
            </Box>
          </Tooltip>
        </TableCell>
        <TableCell>{entry.ownership.team}</TableCell>
        <TableCell>
          <Box display="flex" gap={0.5}>
            {entry.hidden && (
              <Tooltip title="Hidden">
                <VisibilityOffIcon fontSize="small" color="disabled" />
              </Tooltip>
            )}
            {entry.disabled && (
              <Tooltip title="Disabled">
                <LinkOffIcon fontSize="small" color="disabled" />
              </Tooltip>
            )}
            {entry.permissions && (
              <Tooltip title={`Requires: ${entry.permissions.role || entry.permissions.feature_flag}`}>
                <SecurityIcon fontSize="small" color="action" />
              </Tooltip>
            )}
            {entry.test_suite_path && (
              <Tooltip title="Has tests">
                <BugReportIcon fontSize="small" color="success" />
              </Tooltip>
            )}
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom>
                Entry Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                  <Typography variant="body2">{entry.description}</Typography>

                  <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>Ownership</Typography>
                  <Typography variant="body2">
                    Team: {entry.ownership.team}<br />
                    {entry.ownership.slack && <>Slack: {entry.ownership.slack}<br /></>}
                    {entry.ownership.email && <>Email: {entry.ownership.email}<br /></>}
                    {entry.ownership.github && <>GitHub: {entry.ownership.github}</>}
                  </Typography>

                  {entry.keyboard_shortcut && (
                    <>
                      <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>
                        Keyboard Shortcut
                      </Typography>
                      <Chip label={entry.keyboard_shortcut} size="small" variant="outlined" />
                    </>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  {entry.permissions && (
                    <>
                      <Typography variant="subtitle2" color="textSecondary">Permissions</Typography>
                      <Typography variant="body2">
                        {entry.permissions.role && <>Role: {entry.permissions.role}<br /></>}
                        {entry.permissions.feature_flag && <>Feature Flag: {entry.permissions.feature_flag}<br /></>}
                        {entry.permissions.scope && <>Scope: {entry.permissions.scope}</>}
                      </Typography>
                    </>
                  )}

                  {(entry.docs_url || entry.support_url || entry.changelog_url) && (
                    <>
                      <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>Links</Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {entry.docs_url && (
                          <Button size="small" startIcon={<LinkIcon />} href={entry.docs_url} target="_blank">
                            Docs
                          </Button>
                        )}
                        {entry.support_url && (
                          <Button size="small" startIcon={<LinkIcon />} href={entry.support_url} target="_blank">
                            Support
                          </Button>
                        )}
                        {entry.changelog_url && (
                          <Button size="small" startIcon={<LinkIcon />} href={entry.changelog_url} target="_blank">
                            Changelog
                          </Button>
                        )}
                      </Box>
                    </>
                  )}

                  {entry.sli_targets && (
                    <>
                      <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>SLI Targets</Typography>
                      <Typography variant="body2">
                        {entry.sli_targets.availability && <>Availability: {entry.sli_targets.availability}%<br /></>}
                        {entry.sli_targets.latency_p99_ms && <>P99 Latency: {entry.sli_targets.latency_p99_ms}ms<br /></>}
                        {entry.sli_targets.error_rate && <>Error Rate: {entry.sli_targets.error_rate}%</>}
                      </Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function NavigationConsole() {
  const [manifest, setManifest] = useState<NavigationManifest | null>(null);
  const [healthStatuses, setHealthStatuses] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const runHealthChecks = async () => {
    if (!manifest) return;

    setCheckingHealth(true);
    const statuses = new Map();

    for (const entry of manifest.entries) {
      const health = await checkEntryHealth(entry);
      statuses.set(entry.id, health);
    }

    setHealthStatuses(statuses);
    setCheckingHealth(false);
  };

  const filteredEntries = useMemo(() => {
    if (!manifest) return [];
    return manifest.entries.filter(entry =>
      entry.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.ownership.team.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [manifest, searchTerm]);

  const stats = useMemo(() => {
    if (!manifest) return null;

    const total = manifest.entries.length;
    const byStatus = manifest.entries.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byGroup = manifest.entries.reduce((acc, entry) => {
      acc[entry.group] = (acc[entry.group] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const withTests = manifest.entries.filter(e => e.test_suite_path).length;
    const withDocs = manifest.entries.filter(e => e.docs_url).length;
    const withPermissions = manifest.entries.filter(e => e.permissions).length;

    const healthSummary = {
      healthy: 0,
      degraded: 0,
      unavailable: 0,
      unknown: 0,
    };

    healthStatuses.forEach((status) => {
      if (status) {
        healthSummary[status.status as keyof typeof healthSummary]++;
      } else {
        healthSummary.unknown++;
      }
    });

    return { total, byStatus, byGroup, withTests, withDocs, withPermissions, healthSummary };
  }, [manifest, healthStatuses]);

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!manifest) return <Alert severity="warning">No manifest loaded</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Navigation Console
      </Typography>
      <HelpText title="Navigation Console">
        <strong>Command Palette:</strong> Quick keyboard-driven navigation throughout NOFX.
<br /><br />
<strong>How to use:</strong>
<ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
  <li>Type to filter available pages and actions</li>
  <li>Press Enter to navigate</li>
  <li>Use arrow keys to select items</li>
</ul>
<strong>Pro tip:</strong> Access this console anytime with the keyboard shortcut.
      </HelpText>

      <Typography variant="body2" color="textSecondary" paragraph>
        Developer diagnostics and health monitoring for the navigation manifest
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Entries</Typography>
              <Typography variant="h3">{stats?.total || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Test Coverage</Typography>
              <Typography variant="h3">
                {stats ? Math.round((stats.withTests / stats.total) * 100) : 0}%
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {stats?.withTests || 0} of {stats?.total || 0} entries
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Documentation</Typography>
              <Typography variant="h3">
                {stats ? Math.round((stats.withDocs / stats.total) * 100) : 0}%
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {stats?.withDocs || 0} of {stats?.total || 0} entries
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Health Status</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Badge badgeContent={stats?.healthSummary.healthy || 0} color="success">
                  <CheckCircleIcon />
                </Badge>
                <Badge badgeContent={stats?.healthSummary.degraded || 0} color="warning">
                  <WarningIcon />
                </Badge>
                <Badge badgeContent={stats?.healthSummary.unavailable || 0} color="error">
                  <ErrorIcon />
                </Badge>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="All Entries" />
          <Tab label="Issues" />
          <Tab label="Permissions" />
          <Tab label="Manifest Info" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={checkingHealth ? <LinearProgress /> : <RefreshIcon />}
              onClick={runHealthChecks}
              disabled={checkingHealth}
            >
              Check Health
            </Button>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Label</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  healthStatus={healthStatuses.get(entry.id) || null}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Potential Issues</Typography>
          {manifest.entries
            .filter(e => !e.test_suite_path || !e.docs_url || e.status === 'deprecated')
            .map(entry => (
              <Alert key={entry.id} severity="warning" sx={{ mb: 1 }}>
                <AlertTitle>{entry.label} ({entry.path})</AlertTitle>
                {!entry.test_suite_path && <div>• Missing test suite</div>}
                {!entry.docs_url && <div>• Missing documentation URL</div>}
                {entry.status === 'deprecated' && <div>• Marked as deprecated</div>}
              </Alert>
            ))}
        </Paper>
      )}

      {tabValue === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Entry</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Required Role</TableCell>
                <TableCell>Feature Flag</TableCell>
                <TableCell>Scope</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {manifest.entries
                .filter(e => e.permissions)
                .map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell>{entry.path}</TableCell>
                    <TableCell>{entry.permissions?.role || '-'}</TableCell>
                    <TableCell>{entry.permissions?.feature_flag || '-'}</TableCell>
                    <TableCell>{entry.permissions?.scope || '-'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Manifest Information</Typography>
          <Typography variant="body2">
            <strong>Version:</strong> {manifest.version}<br />
            <strong>Generated:</strong> {new Date(manifest.generated_at).toLocaleString()}<br />
            <strong>Environment:</strong> {manifest.metadata?.environment || 'Unknown'}<br />
            <strong>Build ID:</strong> {manifest.metadata?.build_id || 'N/A'}<br />
            <strong>Commit SHA:</strong> {manifest.metadata?.commit_sha || 'N/A'}
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>Groups</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Group</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>Entries</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {manifest.groups.map(group => (
                  <TableRow key={group.id}>
                    <TableCell>{group.id}</TableCell>
                    <TableCell>{group.label}</TableCell>
                    <TableCell>{group.order}</TableCell>
                    <TableCell>{stats?.byGroup[group.id] || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}