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
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#171614] transition-colors cursor-pointer text-left"
    >
      <div className="w-8 h-8 rounded bg-[#171614] border border-[#2C2B28] flex items-center justify-center shrink-0">
        <Icon size={14} className="text-[#9B9590]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#F5F0E8] truncate">{entity.name}</p>
        <p className="text-xs text-[#9B9590] truncate">{entity.subtitle}</p>
      </div>
      <span className="text-[10px] text-[#6B6560] uppercase tracking-wider shrink-0">{typeLabels[entity.type]}</span>
      {entity.metrics && (
        <div className="flex items-center gap-2 shrink-0">
          {Object.entries(entity.metrics).slice(0, 2).map(([key, val]) => (
            <span key={key} className="font-mono text-xs text-[#9B9590]">{val}</span>
          ))}
        </div>
      )}
    </button>
  );
}
