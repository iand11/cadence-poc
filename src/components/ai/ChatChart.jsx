import { useRef, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';
import { formatNumber } from '../../utils/formatters';

const DEFAULT_COLORS = ['#DA7756', '#7BAF73', '#4A90D9', '#D4A574', '#9B7ED8', '#4ECDC4', '#E8B960', '#C75F4F'];

function getColor(i) {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

function CartesianChart({ chartType, data, series, xKey, unit }) {
  const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'area' ? AreaChart : LineChart;
  const fmtValue = (v) => unit ? `${formatNumber(v)} ${unit}` : formatNumber(v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ChartComponent data={data} margin={{ top: 5, right: 5, bottom: 5, left: unit ? 10 : 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} label={unit ? { value: unit, angle: -90, position: 'insideLeft', style: { ...AXIS_STYLE, fill: '#6B6560' } } : undefined} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtValue(v), name]} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#9B9590' }} />}
        {series.map((s, i) => {
          const color = s.color || getColor(i);
          if (chartType === 'bar') {
            return <Bar key={s.key} dataKey={s.key} name={s.name || s.key} fill={color} radius={[2, 2, 0, 0]} />;
          } else if (chartType === 'area') {
            return <Area key={s.key} dataKey={s.key} name={s.name || s.key} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} dot={false} />;
          } else {
            return <Line key={s.key} dataKey={s.key} name={s.name || s.key} stroke={color} strokeWidth={2} dot={false} />;
          }
        })}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

function DonutChart({ data, series, unit }) {
  const nameKey = series[0]?.key || 'name';
  const valueKey = series[1]?.key || 'value';
  const fmtValue = (v) => unit ? `${formatNumber(v)} ${unit}` : formatNumber(v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => <Cell key={i} fill={getColor(i)} />)}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [fmtValue(v), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RadarChartWrapper({ data, series }) {
  const angleKey = series[0]?.key || 'label';
  const valueKeys = series.slice(1);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#3D3B37" />
        <PolarAngleAxis dataKey={angleKey} {...AXIS_STYLE} />
        <PolarRadiusAxis {...AXIS_STYLE} />
        {valueKeys.map((s, i) => (
          <Radar key={s.key} dataKey={s.key} name={s.name || s.key} stroke={s.color || getColor(i)} fill={s.color || getColor(i)} fillOpacity={0.15} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11, color: '#9B9590' }} />
        <Tooltip {...TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default function ChatChart({ chart }) {
  const { chartType, title, data, series, xKey, unit } = chart;
  const chartRef = useRef(null);

  const handleDownload = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#0D0C0B', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${(title || 'chart').replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch { /* ignore */ }
  }, [title]);

  if (!data || !data.length) {
    return <div className="text-sm text-[#9B9590] italic mt-2">Chart unavailable</div>;
  }

  return (
    <div className="mt-3 rounded border border-[#3D3B37] bg-[#0D0C0B] p-4" ref={chartRef}>
      <div className="flex items-center justify-between mb-3">
        {title && (
          <div className="text-xs font-mono text-[#9B9590] uppercase tracking-wider">
            {title}
          </div>
        )}
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] transition-colors cursor-pointer"
        >
          <Download size={12} />
          PNG
        </button>
      </div>
      <div className="w-full">
        {(chartType === 'pie' || chartType === 'donut') ? (
          <DonutChart data={data} series={series || []} unit={unit} />
        ) : chartType === 'radar' ? (
          <RadarChartWrapper data={data} series={series || []} />
        ) : (
          <CartesianChart chartType={chartType} data={data} series={series || []} xKey={xKey || 'name'} unit={unit} />
        )}
      </div>
    </div>
  );
}
