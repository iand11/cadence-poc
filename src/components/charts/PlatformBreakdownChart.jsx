import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/formatters';

const PLATFORMS = [
  { key: 'spotify', name: 'Spotify', color: '#1DB954' },
  { key: 'apple', name: 'Apple Music', color: '#FC3C44' },
  { key: 'youtube', name: 'YouTube Music', color: '#FF0000' },
  { key: 'amazon', name: 'Amazon', color: '#FF9900' },
  { key: 'tidal', name: 'Tidal', color: '#F5F0E8' },
];

export default function PlatformBreakdownChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="month" {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatNumber(value), '']}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9B9590' }} />
        {PLATFORMS.map(p => (
          <Bar key={p.key} dataKey={p.key} name={p.name} fill={p.color} stackId="stack" radius={[0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
