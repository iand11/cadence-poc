import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { MapPin, TrendingUp, AlertTriangle, Music } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import Badge from '../shared/Badge';

const tourData = [
  { city: 'Mexico City', score: 94 },
  { city: 'S\u00e3o Paulo', score: 91 },
  { city: 'London', score: 88 },
  { city: 'Berlin', score: 85 },
  { city: 'Tokyo', score: 83 },
];

const revenueData = [
  { source: 'Streaming', amount: 2980000 },
  { source: 'Sync', amount: 864000 },
  { source: 'Live', amount: 576000 },
  { source: 'Merch', amount: 384000 },
];

const COLORS = ['#DA7756', '#C75F4F', '#7BAF73', '#D4A574', '#D4A574'];

const alertsData = [
  { severity: 'high', title: 'TikTok sound trending', description: "'Midnight Frequency' used in 84K videos in 48hrs" },
  { severity: 'medium', title: 'Spotify algorithmic boost', description: "Release Radar placement drove 340% stream increase" },
];

const playlistData = [
  { name: "Today's Top Hits", followers: '34.2M', position: 12 },
  { name: 'New Music Friday', followers: '15.8M', position: 8 },
  { name: 'Discover Weekly', followers: 'Personalized', position: 3 },
];

function TourInsight() {
  return (
    <div className="bg-[#171614] rounded border border-[#3D3B37] p-4">
      <div className="flex items-center gap-2 mb-3 font-['Epilogue'] text-xs font-medium text-[#9B9590]">
        <MapPin className="w-4 h-4 text-[#DA7756]" />
        Top Recommended Tour Cities
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={tourData} layout="vertical" margin={{ left: 70, right: 10 }}>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis dataKey="city" type="category" tick={{ fill: '#9B9590', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} />
          <Bar dataKey="score" radius={[0, 2, 2, 0]} barSize={16}>
            {tourData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueInsight() {
  return (
    <div className="bg-[#171614] rounded border border-[#3D3B37] p-4">
      <div className="flex items-center gap-2 mb-3 font-['Epilogue'] text-xs font-medium text-[#9B9590]">
        <TrendingUp className="w-4 h-4 text-[#DA7756]" />
        Projected Q2 Revenue Breakdown
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={revenueData} innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="amount" stroke="none">
              {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1.5">
          {revenueData.map((d, i) => (
            <div key={d.source} className="flex items-center gap-2 font-mono text-xs">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-[#9B9590]">{d.source}:</span>
              <span className="text-[#F5F0E8] font-medium">{formatCurrency(d.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsInsight() {
  return (
    <div className="bg-[#171614] rounded border border-[#3D3B37] p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2 font-['Epilogue'] text-xs font-medium text-[#9B9590]">
        <AlertTriangle className="w-4 h-4 text-[#DA7756]" />
        Breakout Signals Detected
      </div>
      {alertsData.map((a, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#1C1B18]">
          <Badge variant={a.severity === 'high' ? 'danger' : 'warning'}>{a.severity}</Badge>
          <div>
            <p className="font-mono text-xs font-medium text-[#F5F0E8]">{a.title}</p>
            <p className="font-mono text-xs text-[#9B9590]">{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaylistInsight() {
  return (
    <div className="bg-[#171614] rounded border border-[#3D3B37] p-4">
      <div className="flex items-center gap-2 mb-3 font-['Epilogue'] text-xs font-medium text-[#9B9590]">
        <Music className="w-4 h-4 text-[#DA7756]" />
        Priority Playlist Targets
      </div>
      <div className="space-y-2">
        {playlistData.map((p, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded bg-[#1C1B18] font-mono text-xs">
            <div>
              <span className="text-[#F5F0E8] font-medium">{p.name}</span>
              <span className="text-[#6B6560] ml-2">{p.followers}</span>
            </div>
            <span className="text-[#DA7756]">#{p.position}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INSIGHT_MAP = {
  tour: TourInsight,
  revenue: RevenueInsight,
  viral: AlertsInsight,
  playlist: PlaylistInsight,
  release: RevenueInsight,
  sync: RevenueInsight,
  audience: TourInsight,
  growth: AlertsInsight,
};

export default function InsightCard({ dataType }) {
  const Component = INSIGHT_MAP[dataType] || TourInsight;
  return <Component />;
}
