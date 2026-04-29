import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber, formatDate } from '../../utils/formatters';

const PLATFORMS = [
  { key: 'tiktok', name: 'TikTok', color: '#ff0050' },
  { key: 'instagram', name: 'Instagram', color: '#E1306C' },
  { key: 'twitter', name: 'Twitter/X', color: '#1DA1F2' },
  { key: 'youtube', name: 'YouTube', color: '#FF0000' },
];

export default function SocialGrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} interval={13} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatNumber(value), '']}
          labelFormatter={formatDate}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9B9590' }} />
        {PLATFORMS.map(p => (
          <Line
            key={p.key}
            type="monotone"
            dataKey={p.key}
            name={p.name}
            stroke={p.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: p.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
