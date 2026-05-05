export function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatNumber(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat().format(n);
}

export function formatPercent(n) {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusColor(status) {
  const map = {
    pending: 'text-surface-400',
    running: 'text-accent',
    completed: 'text-success',
    failed: 'text-danger',
    cancelled: 'text-warning',
  };
  return map[status] || 'text-surface-400';
}

export function statusBg(status) {
  const map = {
    pending: 'bg-surface-400/10 border-surface-400/20',
    running: 'bg-accent/10 border-accent/30',
    completed: 'bg-success/10 border-success/30',
    failed: 'bg-danger/10 border-danger/30',
    cancelled: 'bg-warning/10 border-warning/30',
  };
  return map[status] || 'bg-surface-400/10 border-surface-400/20';
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const methodColor = (method) => {
  const map = {
    GET: 'text-emerald-400',
    POST: 'text-blue-400',
    PUT: 'text-amber-400',
    PATCH: 'text-orange-400',
    DELETE: 'text-red-400',
    HEAD: 'text-purple-400',
    OPTIONS: 'text-surface-400',
  };
  return map[method] || 'text-surface-400';
};
