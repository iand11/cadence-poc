import { BarChart3, TrendingUp, PieChart, Globe, Users, Zap, Radio, LayoutList } from 'lucide-react';

const availableWidgets = [
  { id: 'artist-comparison', label: 'Artist Comparison', icon: LayoutList, category: 'Overview' },
  { id: 'streaming-trends', label: 'Streaming Trends', icon: TrendingUp, category: 'Streaming' },
  { id: 'revenue-breakdown', label: 'Revenue Breakdown', icon: PieChart, category: 'Revenue' },
  { id: 'geography', label: 'Geographic Distribution', icon: Globe, category: 'Audience' },
  { id: 'social-growth', label: 'Social Growth', icon: Users, category: 'Social' },
  { id: 'forecast', label: 'Stream Forecast', icon: Zap, category: 'AI' },
  { id: 'playlists', label: 'Playlist Performance', icon: Radio, category: 'Playlists' },
  { id: 'benchmarks', label: 'Benchmark Radar', icon: BarChart3, category: 'Analysis' },
];

export default function WidgetPicker({ selected, onToggle }) {
  const categories = [...new Set(availableWidgets.map(w => w.category))];

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] text-[#444444] uppercase tracking-wider mb-2">{cat}</p>
          <div className="space-y-1">
            {availableWidgets.filter(w => w.category === cat).map(widget => {
              const isSelected = selected.includes(widget.id);
              return (
                <button
                  key={widget.id}
                  onClick={() => onToggle(widget.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#00D4FF]/10 border border-[#00D4FF]/20' : 'hover:bg-[#0F0F0F] border border-transparent'
                  }`}
                >
                  <widget.icon size={14} className={isSelected ? 'text-[#00D4FF]' : 'text-[#444444]'} />
                  <span className={`text-sm ${isSelected ? 'text-[#F4F0EA]' : 'text-[#888888]'}`}>{widget.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
