import { useParams } from 'react-router';
import { TrendingUp, BarChart3 } from 'lucide-react';
import ProfileLayout from '../components/profile/ProfileLayout';
import CollapsibleSection from '../components/profile/CollapsibleSection';
import ChartCard from '../components/shared/ChartCard';
import DataTable from '../components/shared/DataTable';
import KpiCard from '../components/shared/KpiCard';
import Badge from '../components/shared/Badge';
import { getChartProfile } from '../data/mockProfiles';

const entryColumns = [
  { key: 'position', label: '#' },
  { key: 'title', label: 'Track', align: 'left' },
  { key: 'artist', label: 'Artist' },
  { key: 'change', label: 'Move', format: (v) => {
    if (v === 'NEW') return <Badge variant="success">NEW</Badge>;
    if (v === '—') return <span className="text-[#888888]">—</span>;
    return <span className={v.startsWith('+') ? 'text-[#7ab87a]' : 'text-[#e85d5d]'}>{v}</span>;
  }},
  { key: 'peakPosition', label: 'Peak' },
  { key: 'weeksOn', label: 'Weeks' },
];

export default function ChartProfile() {
  const { id } = useParams();
  const profile = getChartProfile(id);

  return (
    <ProfileLayout title={profile.name} subtitle={`${profile.publisher} — ${profile.frequency} — ${profile.region}`} type="chart" aiSummary={profile.aiSummary}>
      <CollapsibleSection title="Luna Vega on this Chart" icon={TrendingUp} defaultOpen={true}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {profile.aiSummary.keyMetrics.map((m, i) => (
            <KpiCard key={m.label} title={m.label} value={m.value} index={i} />
          ))}
        </div>
        <ChartCard title="Luna Vega Entries">
          <DataTable columns={entryColumns} data={profile.lunaVegaEntries} />
        </ChartCard>
      </CollapsibleSection>

      <CollapsibleSection title="Full Chart" icon={BarChart3}>
        <ChartCard title={`${profile.name} — This Week`}>
          <DataTable columns={entryColumns} data={profile.entries} />
        </ChartCard>
      </CollapsibleSection>
    </ProfileLayout>
  );
}
