import { useState, useRef } from 'react';
import { BarChart3, TrendingUp, PieChart, Globe, Users, Zap, Radio, LayoutList, GripVertical } from 'lucide-react';

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

export const widgetMeta = Object.fromEntries(availableWidgets.map(w => [w.id, w]));

export default function WidgetPicker({ selected, onToggle, onReorder }) {
  const categories = [...new Set(availableWidgets.map(w => w.category))];
  const dragItem = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, id) => {
    dragItem.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Make drag image semi-transparent
    if (e.target) e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    dragItem.current = null;
    setDragOverId(null);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const fromId = dragItem.current;
    if (!fromId || fromId === targetId) return;

    const next = [...selected];
    const fromIdx = next.indexOf(fromId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, fromId);
    onReorder(next);
    dragItem.current = null;
    setDragOverId(null);
  };

  const hasSelected = selected.length > 0;

  return (
    <div className="space-y-4">
      {hasSelected && (
        <div>
          <p className="text-[10px] text-[#DA7756] uppercase tracking-wider mb-2">Order</p>
          <div className="space-y-0.5">
            {selected.map((id) => {
              const widget = availableWidgets.find(w => w.id === id);
              if (!widget) return null;
              const isDragOver = dragOverId === id && dragItem.current !== id;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => handleDrop(e, id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing select-none transition-colors ${
                    isDragOver
                      ? 'bg-[#DA7756]/15 border-[#DA7756]/40'
                      : 'bg-[#DA7756]/5 border-[#DA7756]/15'
                  }`}
                >
                  <GripVertical size={10} className="text-[#6B6560] shrink-0" />
                  <widget.icon size={12} className="text-[#DA7756] shrink-0" />
                  <span className="text-[11px] text-[#F5F0E8] flex-1 truncate">{widget.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] text-[#6B6560] uppercase tracking-wider mb-2">{cat}</p>
          <div className="space-y-1">
            {availableWidgets.filter(w => w.category === cat).map(widget => {
              const isSelected = selected.includes(widget.id);
              return (
                <button
                  key={widget.id}
                  onClick={() => onToggle(widget.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#DA7756]/10 border border-[#DA7756]/20' : 'hover:bg-[#171614] border border-transparent'
                  }`}
                >
                  <widget.icon size={14} className={isSelected ? 'text-[#DA7756]' : 'text-[#6B6560]'} />
                  <span className={`text-sm ${isSelected ? 'text-[#F5F0E8]' : 'text-[#9B9590]'}`}>{widget.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
