import { useEffect, useRef, useState } from 'react';
import { Users, RefreshCw, Loader2, AlertTriangle, Plus } from 'lucide-react';
import DspIcon from './DspIcon';
import { SourceRow } from './StreamCountsPanel';
import {
  fetchStreamTracker, createStreamTracker, recordStreamCount, refreshStreamTracker,
  addStreamSource, removeStreamSource, startFollowerTracking, SERVICE_INFO,
} from '../../data/streamCounts';

// The artist's Instagram followers, TikTok followers and YouTube subscribers before the
// campaign and on every day of it (api/lib/follower-counts.js). Profiles come from the
// artist's catalog links; a missing one is pasted in here.

const FOLLOWER_SERVICES = ['instagram', 'tiktok', 'youtubeChannel'];
const PLACEHOLDER = {
  instagram: 'instagram.com/artist',
  tiktok: 'tiktok.com/@artist',
  youtubeChannel: 'youtube.com/@artist',
};
const BTN = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default';
const inputCls = 'bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-2 py-1.5 text-[11px] font-mono text-[#F5F0E8] placeholder-[#6B6560] outline-none';

export default function FollowersPanel({ directive, updateDirective }) {
  const trackerId = directive.streamTrackerId;
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      setReport(await fn());
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  // A campaign without a tracker yet: start one for the artist's followers
  const canStart = !!(directive.artistSlug && directive.schedule?.startDate && directive.schedule?.endDate);
  useEffect(() => {
    if (trackerId || !canStart || started.current) return;
    started.current = true;
    const id = `trk-${directive.id}`;
    run(() => createStreamTracker({
      id, artistSlug: directive.artistSlug, artistName: directive.artistName,
      startDate: directive.schedule.startDate, endDate: directive.schedule.endDate, campaigns: [directive],
    }))
      .then(() => updateDirective(directive.id, { streamTrackerId: id }))
      .catch(() => {});
  }, [trackerId, canStart, directive, updateDirective]);

  useEffect(() => {
    if (!trackerId) return;
    let cancelled = false;
    fetchStreamTracker(trackerId)
      .then(r => {
        if (cancelled) return;
        setReport(r);
        // Trackers from before follower tracking: look up the artist's profiles once
        if (!r.followers?.started && !started.current) {
          started.current = true;
          run(() => startFollowerTracking(trackerId)).catch(() => {});
        }
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [trackerId]);

  if (!canStart && !trackerId) return null;
  const sources = report ? report.sources.filter(s => FOLLOWER_SERVICES.includes(s.service)) : [];

  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-xs font-medium text-[#F5F0E8]">
          <Users size={12} className="text-[#DA7756]" />Followers
        </h3>
        <button
          onClick={() => run(() => refreshStreamTracker(trackerId, FOLLOWER_SERVICES)).catch(() => {})}
          disabled={busy || !report || !sources.length} className={BTN} title="Read the counts now (normally once a day)"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}Update
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[10px] text-[#C75F4F] mb-3"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}</p>
      )}
      {!report && !error && <Loader2 size={12} className="animate-spin text-[#6B6560]" />}

      {report && (
        <div className="space-y-3">
          {FOLLOWER_SERVICES.map(service => {
            const list = sources.filter(s => s.service === service);
            if (!list.length) {
              return <AddProfile key={service} service={service} busy={busy} onAdd={(url) => run(() => addStreamSource(trackerId, url))} />;
            }
            return list.map(s => (
              <SourceRow
                key={`${s.service}:${s.externalId}`}
                source={s}
                startDate={report.startDate}
                busy={busy}
                onCount={(day, count) => run(() => recordStreamCount(trackerId, { service: s.service, externalId: s.externalId, day, count }))}
                onRemove={() => run(() => removeStreamSource(trackerId, s.service, s.externalId)).catch(() => {})}
              />
            ));
          })}
        </div>
      )}
    </div>
  );
}

// No profile link for this service: ask for it
function AddProfile({ service, busy, onAdd }) {
  const [url, setUrl] = useState('');
  const info = SERVICE_INFO[service];
  const add = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAdd(url.trim()).then(() => setUrl('')).catch(() => {});
  };
  return (
    <form onSubmit={add} className="flex flex-wrap items-center gap-3 bg-[#0D0C0B] border border-dashed border-[#2C2B28] rounded p-3">
      <DspIcon service={info.icon || service} color={info.color} size={14} />
      <p className="text-[11px] text-[#9B9590] w-40 shrink-0">Add {info.label} link</p>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder={PLACEHOLDER[service]} className={`${inputCls} flex-1 min-w-[160px]`} />
      <button type="submit" disabled={busy || !url.trim()} className={BTN}><Plus size={10} />Track</button>
    </form>
  );
}
