import { Link } from 'react-router';
import Markdown from 'react-markdown';
import { CartesianChart, DonutChart, RadarChartWrapper } from '../ai/ChatChart';
import { formatNumber, formatCurrency, formatDelta } from '../../utils/formatters';

// Renders a custom widget spec built by the model (src/data/customWidgets.js).

const CHART_HEIGHT = 220;

function formatValue(v, format) {
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') {
    const n = Number(v);
    if (format && format !== 'text' && format !== 'date' && Number.isFinite(n)) return formatValue(n, format);
    if (format === 'date' && !Number.isNaN(Date.parse(v))) {
      return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return String(v);
  }
  if (format === 'currency') return formatCurrency(v);
  if (format === 'percent') return `${Math.round(v * 10) / 10}%`;
  if (format === 'text') return String(v);
  return Math.abs(v) < 1000 && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : formatNumber(v);
}

// Only app paths are followed; anything else renders as plain text.
const appPath = (p) => (typeof p === 'string' && /^\/app\/[\w\-./%]+$/.test(p) ? p : null);

const firstKey = (rows, type) => {
  const row = rows.find(r => r && typeof r === 'object') || {};
  return Object.keys(row).find(k => typeof row[k] === type);
};

function seriesFor(spec, rows) {
  if (spec.series?.length) return spec.series;
  const row = rows[0] || {};
  return Object.keys(row).filter(k => typeof row[k] === 'number').map(key => ({ key }));
}

function MetricView({ metrics = [] }) {
  return (
    <div className={`grid gap-2 ${metrics.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {metrics.map((m, i) => (
        <div key={i} className="rounded border border-[#2C2B28] bg-[#0D0C0B] px-3 py-3">
          <p className="text-[10px] text-[#6B6560] truncate">{m.label}</p>
          <p className="text-xl font-mono text-[#F5F0E8] mt-1">{formatValue(m.value, m.format)}</p>
          {typeof m.change === 'number' && (
            <p className={`text-[10px] font-mono mt-0.5 ${m.change >= 0 ? 'text-[#7BAF73]' : 'text-[#C75F4F]'}`}>{formatDelta(m.change)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function TableView({ spec, rows }) {
  const columns = spec.columns?.length
    ? spec.columns
    : Object.keys(rows[0] || {}).map(key => ({ key, label: key }));
  return (
    <div className="overflow-auto max-h-80">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[#2C2B28]">
            {columns.map(c => (
              <th key={c.key} className={`px-2 py-1.5 font-medium text-[#6B6560] whitespace-nowrap ${c.format && c.format !== 'text' && c.format !== 'date' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#2C2B28]/60 last:border-0">
              {columns.map(c => {
                const text = formatValue(row[c.key], c.format);
                const to = appPath(c.link ? row[c.link] : null);
                return (
                  <td key={c.key} className={`px-2 py-1.5 ${c.format && c.format !== 'text' && c.format !== 'date' ? 'text-right font-mono text-[#9B9590]' : 'text-[#F5F0E8]'}`}>
                    {to ? <Link to={to} className="hover:text-[#DA7756] transition-colors">{text}</Link> : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ items = [] }) {
  return (
    <div className="space-y-0.5 max-h-80 overflow-auto">
      {items.map((item, i) => {
        const to = appPath(item.link);
        const row = (
          <div className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#0D0C0B] transition-all">
            <span className="text-[10px] font-mono text-[#6B6560] w-4 text-right shrink-0">{i + 1}</span>
            {item.imageUrl && /^https:\/\//.test(item.imageUrl) ? (
              <img src={item.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className={`text-xs text-[#F5F0E8] truncate ${to ? 'group-hover:text-[#DA7756]' : ''} transition-colors`}>{item.title}</p>
              {item.subtitle && <p className="text-[9px] text-[#6B6560] truncate">{item.subtitle}</p>}
            </div>
            {item.value != null && <span className="text-[10px] font-mono text-[#9B9590] shrink-0">{formatValue(item.value, item.format)}</span>}
          </div>
        );
        return to ? <Link key={i} to={to} className="block">{row}</Link> : <div key={i}>{row}</div>;
      })}
    </div>
  );
}

export function CustomWidgetView({ spec }) {
  const rows = Array.isArray(spec.data) ? spec.data : [];
  switch (spec.type) {
    case 'metric':
      return <MetricView metrics={spec.metrics} />;
    case 'table':
      return <TableView spec={spec} rows={rows} />;
    case 'list':
      return <ListView items={spec.items} />;
    case 'pie': {
      const series = spec.series?.length >= 2 ? spec.series
        : [{ key: firstKey(rows, 'string') || 'name' }, { key: firstKey(rows, 'number') || 'value' }];
      return <DonutChart data={rows} series={series} unit={spec.unit} height={CHART_HEIGHT} />;
    }
    case 'radar': {
      const angle = spec.xKey || firstKey(rows, 'string') || 'label';
      const values = seriesFor(spec, rows).filter(s => s.key !== angle);
      return <RadarChartWrapper data={rows} series={[{ key: angle }, ...values]} height={CHART_HEIGHT} />;
    }
    case 'bar':
    case 'line':
    case 'area': {
      const xKey = spec.xKey || firstKey(rows, 'string') || 'name';
      return <CartesianChart chartType={spec.type} data={rows} series={seriesFor(spec, rows).filter(s => s.key !== xKey)} xKey={xKey} unit={spec.unit} height={CHART_HEIGHT} />;
    }
    default:
      return (
        <div className="prose-chat text-xs leading-relaxed text-[#F5F0E8]">
          <Markdown>{spec.text || ''}</Markdown>
        </div>
      );
  }
}

/** The body of a custom widget card on the dashboard. */
export function CustomWidgetBody({ widget }) {
  const { spec, refreshing, error } = widget;
  return (
    <div className="relative">
      <div className={refreshing ? 'opacity-30 pointer-events-none' : ''}>
        <CustomWidgetView spec={spec} />
      </div>
      {refreshing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-[#2C2B28] border-t-[#DA7756] animate-spin" />
        </div>
      )}
      {error && <p className="mt-2 text-[10px] text-[#C75F4F]">Couldn't refresh: {error}</p>}
    </div>
  );
}
