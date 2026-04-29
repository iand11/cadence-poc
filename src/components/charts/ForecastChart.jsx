import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber, formatDate } from '../../utils/formatters';

export default function ForecastChart({ data, todayIndex = 60 }) {
  const todayDate = data[todayIndex]?.date;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b9bd5" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#5b9bd5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b9bd5" stopOpacity={0.06} />
            <stop offset="100%" stopColor="#5b9bd5" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} interval={13} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [formatNumber(value), name]}
          labelFormatter={formatDate}
        />
        {todayDate && (
          <ReferenceLine
            x={todayDate}
            stroke="#888888"
            strokeDasharray="5 5"
            label={{ value: 'Now', position: 'top', fill: '#888888', fontSize: 12 }}
          />
        )}
        <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gradientBand)" name="Upper Bound" />
        <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" name="Lower Bound" />
        <Area type="monotone" dataKey="actual" stroke="#00D4FF" fill="url(#gradientActual)" strokeWidth={2} name="Actual" dot={false} />
        <Area type="monotone" dataKey="forecast" stroke="#5b9bd5" fill="url(#gradientForecast)" strokeWidth={2} strokeDasharray="8 4" name="Forecast" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
