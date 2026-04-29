import { formatNumber } from '../../utils/formatters';

const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', color: '#1DB954' },
  { key: 'apple', label: 'Apple Music', color: '#FC3C44' },
  { key: 'deezer', label: 'Deezer', color: '#A238FF' },
  { key: 'amazon', label: 'Amazon', color: '#25D1DA' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000' },
];

function Bar({ value, max, color, label }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-[10px] font-mono text-[#888888] shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-[#1E1E1E] rounded overflow-hidden relative">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: color, opacity: 0.8 }}
        />
      </div>
      <span className="w-16 text-right text-xs font-mono text-[#F4F0EA] shrink-0">{formatNumber(value)}</span>
    </div>
  );
}

export default function PlaylistDistributionChart({ playlists }) {
  const rows = PLATFORMS.map(p => {
    const d = playlists[p.key];
    return {
      ...p,
      editorial: d.editorial || 0,
      total: d.total || 0,
      reach: d.reach || 0,
      editorialReach: d.editorialReach || 0,
      editorialRate: d.total > 0 ? ((d.editorial / d.total) * 100).toFixed(1) : '0.0',
    };
  });

  const maxEditorial = Math.max(...rows.map(r => r.editorial));
  const maxTotal = Math.max(...rows.map(r => r.total));

  return (
    <div className="space-y-6">
      {/* Editorial Playlists — the metric that matters for A&R */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">Editorial Playlists</span>
          <span className="text-[10px] text-[#444444]">Curated by platform editors</span>
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <Bar key={r.key} value={r.editorial} max={maxEditorial} color={r.color} label={r.label} />
          ))}
        </div>
      </div>

      {/* Total playlists */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">Total Playlists</span>
          <span className="text-[10px] text-[#444444]">Editorial + user-generated + algorithmic</span>
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <Bar key={r.key} value={r.total} max={maxTotal} color={r.color} label={r.label} />
          ))}
        </div>
      </div>

      {/* Reach & editorial rate summary */}
      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-[#1E1E1E]">
        {rows.map(r => (
          <div key={r.key} className="text-center">
            <div className="text-[10px] text-[#888888] mb-1">{r.label}</div>
            <div className="text-xs font-mono text-[#F4F0EA]">{r.editorialRate}%</div>
            <div className="text-[10px] text-[#444444]">editorial rate</div>
            {r.reach > 0 && (
              <>
                <div className="text-xs font-mono text-[#F4F0EA] mt-1">{formatNumber(r.reach)}</div>
                <div className="text-[10px] text-[#444444]">reach</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
