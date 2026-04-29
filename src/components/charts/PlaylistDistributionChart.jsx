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
      <span className="w-20 text-right text-[10px] font-mono text-[#9B9590] shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-[#2C2B28] rounded overflow-hidden relative">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: color, opacity: 0.8 }}
        />
      </div>
      <span className="w-16 text-right text-xs font-mono text-[#F5F0E8] shrink-0">{formatNumber(value)}</span>
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
          <span className="text-xs font-medium text-[#9B9590] uppercase tracking-wider">Editorial Playlists</span>
          <span className="text-[10px] text-[#6B6560]">Curated by platform editors</span>
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
          <span className="text-xs font-medium text-[#9B9590] uppercase tracking-wider">Total Playlists</span>
          <span className="text-[10px] text-[#6B6560]">Editorial + user-generated + algorithmic</span>
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <Bar key={r.key} value={r.total} max={maxTotal} color={r.color} label={r.label} />
          ))}
        </div>
      </div>

      {/* Reach & editorial rate summary */}
      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-[#2C2B28]">
        {rows.map(r => (
          <div key={r.key} className="text-center">
            <div className="text-[10px] text-[#9B9590] mb-1">{r.label}</div>
            <div className="text-xs font-mono text-[#F5F0E8]">{r.editorialRate}%</div>
            <div className="text-[10px] text-[#6B6560]">editorial rate</div>
            {r.reach > 0 && (
              <>
                <div className="text-xs font-mono text-[#F5F0E8] mt-1">{formatNumber(r.reach)}</div>
                <div className="text-[10px] text-[#6B6560]">reach</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
