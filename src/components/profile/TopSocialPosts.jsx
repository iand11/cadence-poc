import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Rocket } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import ChartCard from '../shared/ChartCard';
import ContentFeedItem from '../ads/ContentFeedItem';
import { fetchContentFeed } from '../../data/artistsRemote';
import { useAsync } from '../../hooks/useAsync';
import { analyzeBoostPotential } from '../../utils/boostDetection';
import { buildBoostPayload } from '../../utils/boostPayload';

const LIMIT = 5;

/**
 * Profile section with the artist's top social posts by engagement. "Boost"
 * opens the Campaigns page with a campaign draft for that post already loaded
 * in the builder. Renders nothing while loading or when the artist has no posts.
 */
export default function TopSocialPosts({ artist }) {
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => fetchContentFeed({ artist: artist.slug, sort: 'engagement', limit: LIMIT }),
    [artist.slug],
  );
  const items = useMemo(() => data?.items || [], [data]);

  const boostMap = useMemo(() => {
    const map = {};
    const averages = data?.artistAverages || {};
    for (const item of items) {
      const avg = averages[item.artistId]?.[item.platform]?.[item.contentType];
      if (avg) map[item.id] = analyzeBoostPotential(item, avg);
    }
    return map;
  }, [items, data]);

  const handleBoost = (item) => {
    const boost = buildBoostPayload(item, boostMap[item.id]);
    if (boost) navigate('/app/campaigns', { state: { boost } });
  };

  if (loading || error || items.length === 0) return null;

  return (
    <CollapsibleSection title="Top Social Posts" icon={Rocket} defaultOpen={true}>
      <ChartCard title={`Top ${items.length} post${items.length === 1 ? '' : 's'} by engagement`} subtitle="Boost a post to open a campaign draft for it on the Campaigns page">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {items.map(item => (
            <ContentFeedItem key={item.id} item={item} boostAnalysis={boostMap[item.id]} onBoost={handleBoost} />
          ))}
        </div>
      </ChartCard>
    </CollapsibleSection>
  );
}
