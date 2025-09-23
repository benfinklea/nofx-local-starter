import * as React from 'react';
import { useParams } from 'react-router-dom';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StatusChip from '../../components/StatusChip';
import MetadataTable from '../../components/responses/MetadataTable';
import AudioArtifacts from '../../components/responses/AudioArtifacts';
import ImageArtifacts from '../../components/responses/ImageArtifacts';
import TimelineTable from '../../components/responses/TimelineTable';
import DelegationsTable from '../../components/responses/DelegationsTable';
import IncidentsTable from '../../components/responses/IncidentsTable';
import {
  getResponsesRun,
  retryResponsesRun,
  addModeratorNote,
  logUiEvent,
  type ResponsesRunDetail,
  type ModeratorNote,
  type DelegationRecord,
  type IncidentRecord,
} from '../../lib/responses';

export default function ResponsesRunDetail() {
  const { id } = useParams();
  const [detail, setDetail] = React.useState<ResponsesRunDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rawExpanded, setRawExpanded] = React.useState(false);
  const [noteForm, setNoteForm] = React.useState({ reviewer: '', note: '', disposition: 'approved' });
  const [submittingNote, setSubmittingNote] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const payload = await getResponsesRun(id);
      setDetail(payload);
      logUiEvent({ source: 'responses-run-detail', intent: 'view', metadata: { runId: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Responses run');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const retry = async () => {
    if (!id) return;
    await retryResponsesRun(id);
    logUiEvent({ source: 'responses-run-detail', intent: 'retry', metadata: { runId: id } });
    await load();
  };

  const submitNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    try {
      setSubmittingNote(true);
      await addModeratorNote(id, noteForm);
      setNoteForm({ reviewer: '', note: '', disposition: 'approved' });
      logUiEvent({ source: 'responses-run-detail', intent: 'moderation-note', metadata: { runId: id, disposition: noteForm.disposition } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record note');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center"><CircularProgress /></Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>
      </Container>
    );
  }

  if (!detail || !detail.run) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>No Responses run found for {id}</Typography>
      </Container>
    );
  }

  const { run } = detail;

  return (
    <Container sx={{ mt: 2, mb: 6 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5">Responses Run {run.runId}</Typography>
          <Typography variant="body2" color="text.secondary">Model: {run.model ?? '—'}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <StatusChip status={run.status} size="medium" />
          <Button variant="contained" onClick={retry}>Retry Run</Button>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Assistant Output</Typography>
            {detail.bufferedMessages.length ? (
              <Stack spacing={2}>
                {detail.bufferedMessages.map((msg) => (
                  <Paper key={msg.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">No assistant messages buffered.</Typography>
            )}
            {detail.refusals.length ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {detail.refusals.join('\n')}
              </Alert>
            ) : null}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Multimodal Artifacts</Typography>
            <Box mb={3}>
              <Typography variant="subtitle2">Assistant Audio</Typography>
              <AudioArtifacts segments={detail.outputAudio || []} />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2">Generated Images</Typography>
              <ImageArtifacts artifacts={detail.outputImages || []} />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2">Input Transcripts</Typography>
              {detail.inputTranscripts.length ? (
                <List dense>
                  {detail.inputTranscripts.map((item) => (
                    <ListItem key={item.itemId}>
                      <ListItemText primary={item.itemId} secondary={item.transcript} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No input transcripts recorded.</Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Timeline</Typography>
            <TimelineTable events={detail.events || []} />
            <Box mt={2}>
              <Button size="small" onClick={() => setRawExpanded((prev) => !prev)} startIcon={rawExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
                {rawExpanded ? 'Hide Raw Events' : 'Show Raw Events'}
              </Button>
              <Collapse in={rawExpanded} unmountOnExit>
                <Paper variant="outlined" sx={{ p: 2, mt: 1, maxHeight: 260, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {JSON.stringify(detail.events, null, 2)}
                </Paper>
              </Collapse>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Run Metadata</Typography>
            <MetadataTable metadata={run.metadata ?? {}} />
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" display="block">Created: {new Date(run.createdAt).toLocaleString()}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">Updated: {new Date(run.updatedAt).toLocaleString()}</Typography>
            {run.traceId && <Typography variant="caption" color="text.secondary" display="block">Trace ID: {run.traceId}</Typography>}
            {run.safety && (
              <Box mt={2}>
                <Typography variant="subtitle2">Safety Snapshot</Typography>
                <Typography variant="body2" color="text.secondary">Hash: {run.safety.hashedIdentifier ?? '—'}</Typography>
                <Typography variant="body2" color="text.secondary">Refusals: {run.safety.refusalCount}</Typography>
              </Box>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Moderator Notes</Typography>
            {run.safety?.moderatorNotes?.length ? (
              <List dense>
                {run.safety.moderatorNotes.map((note: ModeratorNote, idx: number) => (
                  <ListItem key={`${note.recordedAt}-${idx}`} alignItems="flex-start">
                    <ListItemAvatar><Avatar>{note.reviewer.slice(0, 2).toUpperCase()}</Avatar></ListItemAvatar>
                    <ListItemText
                      primary={`${note.reviewer} • ${note.disposition}`}
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary">{new Date(note.recordedAt).toLocaleString()}</Typography>
                          <Typography variant="body2">{note.note}</Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">No moderator notes recorded.</Typography>
            )}
            <Box component="form" onSubmit={submitNote} mt={2} display="grid" gap={1.5}>
              <TextField
                label="Reviewer"
                size="small"
                required
                value={noteForm.reviewer}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, reviewer: event.target.value }))}
              />
              <TextField
                label="Note"
                size="small"
                multiline
                minRows={3}
                value={noteForm.note}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, note: event.target.value }))}
              />
              <TextField
                label="Disposition"
                size="small"
                select
                value={noteForm.disposition}
                onChange={(event) => setNoteForm((prev) => ({ ...prev, disposition: event.target.value }))}
              >
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="escalated">Escalated</MenuItem>
                <MenuItem value="blocked">Blocked</MenuItem>
                <MenuItem value="info">Info</MenuItem>
              </TextField>
              <Button type="submit" variant="contained" disabled={submittingNote}>
                {submittingNote ? 'Saving…' : 'Add Note'}
              </Button>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Incidents</Typography>
            <IncidentsTable rows={detail.incidents || []} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Delegations</Typography>
            <DelegationsTable rows={detail.delegations || []} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
