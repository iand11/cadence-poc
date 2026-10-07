function spotifyArtistId(url) {
  const m = url?.match(/open\.spotify\.com\/artist\/(\w+)/) || url?.match(/spotify:artist:(\w+)/);
  return m ? m[1] : null;
}

/**
 * A single Spotify player for the artist (Spotify's artist embed, which
 * includes their top tracks). Falls back to the artist's top track when we
 * have no Spotify artist link. Renders nothing if neither exists.
 */
export default function SpotifyPlayer({ artist, tracks }) {
  const artistId = spotifyArtistId(artist.spotifyUrl);
  const topTrack = tracks.find(t => t.spotifyTrackId);
  const embed = artistId
    ? { type: 'artist', id: artistId, height: 352 }
    : topTrack ? { type: 'track', id: topTrack.spotifyTrackId, height: 152 } : null;

  if (!embed) return null;

  return (
    <iframe
      key={`${embed.type}-${embed.id}`}
      title={`${artist.name} on Spotify`}
      src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?utm_source=generator&theme=0`}
      width="100%"
      height={embed.height}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      style={{ maxWidth: '100%', backgroundColor: 'transparent', borderRadius: 12 }}
    />
  );
}
