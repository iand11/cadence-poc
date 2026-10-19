export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatCurrency(n) {
  if (n == null || Number.isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

// $19.7M / $842.5K / $950 — for tight spaces like a donut's center label.
export function formatCurrencyCompact(n) {
  if (n == null || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatDollar(n) {
  if (n == null || Number.isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatDelta(n) {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1) + '%';
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Short age for the card subtitle: "now", "5m ago", "3h ago", "2d ago". */
export function formatAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60e3) return 'now';
  if (ms < 3600e3) return `${Math.floor(ms / 60e3)}m ago`;
  if (ms < 86400e3) return `${Math.floor(ms / 3600e3)}h ago`;
  return `${Math.floor(ms / 86400e3)}d ago`;
}
