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
