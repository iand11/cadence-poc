import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatCurrency } from '../../utils/formatters';

const COLORS = ['#00D4FF', '#e85d5d', '#7ab87a', '#5b9bd5'];

export default function RevenueDonutChart({ data, totalRevenue }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
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
        <text x="50%" y="48%" textAnchor="middle" fill="#F4F0EA" fontSize={24} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {formatCurrency(totalRevenue)}
        </text>
        <text x="50%" y="58%" textAnchor="middle" fill="#888888" fontSize={12} fontFamily="'JetBrains Mono', monospace">
          Total Revenue
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
