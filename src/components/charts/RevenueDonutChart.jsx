import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatCurrency } from '../../utils/formatters';

const COLORS = ['#DA7756', '#C75F4F', '#7BAF73', '#D4A574'];

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
        <text x="50%" y="48%" textAnchor="middle" fill="#F5F0E8" fontSize={24} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {formatCurrency(totalRevenue)}
        </text>
        <text x="50%" y="58%" textAnchor="middle" fill="#9B9590" fontSize={12} fontFamily="'JetBrains Mono', monospace">
          Total Revenue
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
