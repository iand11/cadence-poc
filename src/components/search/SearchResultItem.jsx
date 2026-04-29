import { Music, Disc3, ListMusic, BarChart3 } from 'lucide-react';

const typeIcons = {
  artist: Music,
  track: Disc3,
  playlist: ListMusic,
  chart: BarChart3,
};

const typeLabels = {
  artist: 'Artist',
  track: 'Track',
  playlist: 'Playlist',
  chart: 'Chart',
};

export default function SearchResultItem({ entity, onClick }) {
  const Icon = typeIcons[entity.type] || Music;

  return (
    <button
      onClick={() => onClick(entity)}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#0F0F0F] transition-colors cursor-pointer text-left"
    >
      <div className="w-8 h-8 rounded bg-[#0F0F0F] border border-[#1E1E1E] flex items-center justify-center shrink-0">
        <Icon size={14} className="text-[#888888]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#F4F0EA] truncate">{entity.name}</p>
        <p className="text-xs text-[#888888] truncate">{entity.subtitle}</p>
      </div>
      <span className="text-[10px] text-[#444444] uppercase tracking-wider shrink-0">{typeLabels[entity.type]}</span>
      {entity.metrics && (
        <div className="flex items-center gap-2 shrink-0">
          {Object.entries(entity.metrics).slice(0, 2).map(([key, val]) => (
            <span key={key} className="font-mono text-xs text-[#888888]">{val}</span>
          ))}
        </div>
      )}
    </button>
  );
}
