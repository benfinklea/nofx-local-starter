export function formatNumber(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return value.toLocaleString();
}

export function formatCurrency(value?: number): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `$${amount.toFixed(2)}`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function formatTime(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString();
}

export function formatPercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function formatRemaining(current?: number, limit?: number): string {
  if (typeof current !== 'number' || Number.isNaN(current)) return '—';
  if (typeof limit !== 'number' || Number.isNaN(limit)) return current.toLocaleString();
  return `${current.toLocaleString()} / ${limit.toLocaleString()}`;
}
