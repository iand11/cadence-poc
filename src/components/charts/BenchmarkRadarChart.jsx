import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TOOLTIP_STYLE } from '../../utils/chartTheme';

export default function BenchmarkRadarChart({ artist, benchmark, dimensions, artistName }) {
  const data = dimensions.map((dim, i) => ({
    dimension: dim,
    artist: artist.normalized[i],
    benchmark: benchmark.normalized[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#2C2B28" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#9B9590', fontSize: 12 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${v}/100`} />
        <Radar name={artistName || 'Artist'} dataKey="artist" stroke="#DA7756" fill="#DA7756" fillOpacity={0.3} strokeWidth={2} />
        <Radar name="Roster Average" dataKey="benchmark" stroke="#9B9590" fill="#9B9590" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9B9590' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
