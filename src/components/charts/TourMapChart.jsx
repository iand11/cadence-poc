import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function TourMapChart({ data }) {
  const chartData = data.map(d => ({
    ...d,
    dateNum: new Date(d.date).getTime(),
    size: Math.max(d.capacity / 500, 10),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey="dateNum"
          type="number"
          {...AXIS_STYLE}
          tickFormatter={(v) => formatDate(new Date(v).toISOString())}
          domain={['auto', 'auto']}
          name="Date"
        />
        <YAxis dataKey="revenue" {...AXIS_STYLE} tickFormatter={formatCurrency} width={60} name="Revenue" />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => {
            if (name === 'Revenue') return [formatCurrency(value), name];
            if (name === 'Date') return [formatDate(new Date(value).toISOString()), name];
            return [value, name];
          }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-sm p-3 text-sm font-mono">
                <p className="font-semibold text-[#F4F0EA]">{d.city}</p>
                <p className="text-[#888888]">{d.venue}</p>
                <p className="text-[#888888]">{formatDate(d.date)} · {formatCurrency(d.revenue)}</p>
                <p className="text-[#888888]">{d.ticketsSold.toLocaleString()}/{d.capacity.toLocaleString()} sold</p>
              </div>
            );
          }}
        />
        <Scatter data={chartData} name="Shows">
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={d.status === 'Sold Out' ? '#7ab87a' : d.status === 'On Sale' ? '#00D4FF' : '#888888'}
              r={d.size}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
