import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatCurrency, formatCurrencyCompact } from '../../utils/formatters';

const COLORS = ['#DA7756', '#C75F4F', '#7BAF73', '#D4A574'];
const INNER_RADIUS = 70;
const OUTER_RADIUS = 110;

// Size the center label so it always fits the donut hole: monospace glyphs
// are ~0.6em wide, and we leave some breathing room inside the inner diameter.
function centerFontSize(label) {
  const usable = INNER_RADIUS * 2 * 0.8;
  return Math.min(24, Math.floor(usable / (label.length * 0.6)));
}

export default function RevenueDonutChart({ data, totalRevenue }) {
  const label = formatCurrencyCompact(totalRevenue);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={INNER_RADIUS}
          outerRadius={OUTER_RADIUS}
          paddingAngle={3}
          dataKey="amount"
          nameKey="source"
          stroke="none"
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [formatCurrency(value), '']}
        />
        <text x="50%" y="48%" textAnchor="middle" fill="#F5F0E8" fontSize={centerFontSize(label)} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          <title>{formatCurrency(totalRevenue)}</title>
          {label}
        </text>
        <text x="50%" y="58%" textAnchor="middle" fill="#9B9590" fontSize={12} fontFamily="'JetBrains Mono', monospace">
          Total Revenue
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
