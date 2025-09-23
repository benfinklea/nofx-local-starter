import * as React from 'react';
import Chip from '@mui/material/Chip';

type StatusVariant = 'success' | 'error' | 'info' | 'warning' | 'default';

export interface StatusChipProps {
  status?: string | null;
  size?: 'small' | 'medium';
}

function resolveVariant(status?: string | null): StatusVariant {
  if (!status) return 'default';
  const normalized = status.toLowerCase();
  if (['completed', 'succeeded', 'success'].includes(normalized)) return 'success';
  if (['failed', 'cancelled', 'error'].includes(normalized)) return 'error';
  if (['running', 'in_progress', 'queued', 'pending'].includes(normalized)) return 'info';
  if (['warning', 'refused', 'incomplete'].includes(normalized)) return 'warning';
  return 'default';
}

export const StatusChip = React.memo(function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const variant = resolveVariant(status);
  return <Chip label={status ?? 'unknown'} color={variant} size={size} variant={variant === 'default' ? 'outlined' : 'filled'} />;
});

export default StatusChip;
