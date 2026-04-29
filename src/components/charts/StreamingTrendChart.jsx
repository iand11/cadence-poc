import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber, formatDate } from '../../utils/formatters';

const PLATFORMS = [
  { key: 'spotify', name: 'Spotify', color: '#1DB954' },
  { key: 'apple', name: 'Apple Music', color: '#FC3C44' },
  { key: 'youtube', name: 'YouTube Music', color: '#FF0000' },
  { key: 'amazon', name: 'Amazon', color: '#FF9900' },
  { key: 'tidal', name: 'Tidal', color: '#F5F0E8' },
];

export default function StreamingTrendChart({ data, activePlatforms = null }) {
  const platforms = activePlatforms
    ? PLATFORMS.filter(p => activePlatforms.includes(p.key))
    : PLATFORMS;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          {platforms.map(p => (
            <linearGradient key={p.key} id={`gradient-${p.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={p.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} interval={13} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatNumber(value), '']}
          labelFormatter={formatDate}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9B9590' }} />
        {platforms.map(p => (
          <Area
            key={p.key}
            type="monotone"
            dataKey={p.key}
            name={p.name}
            stroke={p.color}
            fill={`url(#gradient-${p.key})`}
            strokeWidth={2}
            stackId="1"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
