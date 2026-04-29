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
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star size={14} className="text-[#DA7756]" />
        <span className="text-xs font-medium text-[#9B9590]">Favorites</span>
      </div>
      <div className="space-y-1">
        {favorites.map((fav) => {
          const Icon = typeIcons[fav.type];
          return (
            <Link
              key={fav.path}
              to={fav.path}
              className="flex items-center gap-3 py-2.5 px-2 rounded hover:bg-[#1C1B18] transition-colors group"
            >
              <div className="w-7 h-7 rounded bg-[#1C1B18] group-hover:bg-[#232220] flex items-center justify-center shrink-0">
                <Icon size={12} className="text-[#6B6560]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F5F0E8] truncate">{fav.name}</p>
                <p className="text-[10px] text-[#6B6560]">{fav.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
