import { Link } from 'react-router';
import { Star, Music, Disc3, ListMusic, BarChart3 } from 'lucide-react';
import { getTopArtists } from '../../data/artists';

const typeIcons = { artist: Music, track: Disc3, playlist: ListMusic, chart: BarChart3 };

function formatListeners(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const topArtists = getTopArtists(5);

const favorites = topArtists.map(a => ({
  type: 'artist',
  name: a.name,
  path: '/artist/' + a.slug,
  detail: formatListeners(a.spotify.monthlyListeners) + ' listeners',
}));

export default function FavoritesSidebar() {
  return (
    <div className="bg-[#0F0F0F] border border-[#1E1E1E] rounded p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star size={14} className="text-[#00D4FF]" />
        <span className="text-xs font-medium text-[#888888]">Favorites</span>
      </div>
      <div className="space-y-1">
        {favorites.map((fav) => {
          const Icon = typeIcons[fav.type];
          return (
            <Link
              key={fav.path}
              to={fav.path}
              className="flex items-center gap-3 py-2.5 px-2 rounded hover:bg-[#141414] transition-colors group"
            >
              <div className="w-7 h-7 rounded bg-[#141414] group-hover:bg-[#1c1c1f] flex items-center justify-center shrink-0">
                <Icon size={12} className="text-[#444444]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F4F0EA] truncate">{fav.name}</p>
                <p className="text-[10px] text-[#444444]">{fav.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
