/**
 * Client-side CSV parser for Google Sheets integration.
 * Ported from artistsheets server-side logic.
 */

export function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([\w-]+)/);
  return match ? match[1] : null;
}

function extractGid(url) {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match ? match[1] : '0';
}

export function toCSVUrl(url) {
  if (url.includes('/pub?') || url.includes('output=csv') || url.includes('format=csv')) {
    return url;
  }
  const id = extractSheetId(url);
  if (id) {
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${extractGid(url)}`;
  }
  return url;
}

function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCSV(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const firstCell = parseCSVLine(lines[0])[0]?.toLowerCase() ?? '';
  const isHeader = ['label', 'key', 'metric', 'name', 'stat'].includes(firstCell);
  return lines
    .slice(isHeader ? 1 : 0)
    .map((line) => {
      const cells = parseCSVLine(line);
      return { label: cells[0] ?? '', value: cells[1] ?? '' };
    })
    .filter((row) => row.label && row.value);
}
