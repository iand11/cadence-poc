import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AXIS_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/formatters';

const COLORS = ['#DA7756', '#C75F4F', '#7BAF73', '#D4A574'];

export default function PlaylistFunnelChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
        <XAxis type="number" {...AXIS_STYLE} />
        <YAxis dataKey="tier" type="category" {...AXIS_STYLE} width={110} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [value + ' placements', '']}
        />
        <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={28}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
