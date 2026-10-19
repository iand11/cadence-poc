import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Headphones, TrendingUp, TrendingDown, RefreshCw, Loader2, AlertTriangle, Info, Plus, ChevronDown, Trash2, ExternalLink } from 'lucide-react';
import DspIcon from './DspIcon';
import {
  fetchStreamTracker, createStreamTracker, recordStreamCount, refreshStreamTracker,
  addStreamSource, removeStreamSource, smartLinkSlug,
} from '../../data/streamCounts';
import { fetchSmartLinks, linkTitle } from '../../data/smartLinks';
import { formatNumber } from '../../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme';

// Streams on each streaming service before the campaign and on every day of it.
// YouTube is read daily from its API, Spotify from its public web player page; a
// Spotify count can also be typed in when a day's read fails.

const SOURCE_LABELS = {
  spotify: { track: 'Spotify track', album: 'Spotify album' },
  youtube: { video: 'YouTube video' },
};
const sourceLabel = (s) => SOURCE_LABELS[s.service]?.[s.kind] || s.service;
const shortDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const full = (n) => (n == null ? '–' : Number(n).toLocaleString('en-US'));
const signed = (n) => (n == null ? '–' : `${n >= 0 ? '+' : ''}${Number(n).toLocaleString('en-US')}`);
const todayIso = () => new Date().toISOString().slice(0, 10);
const inputCls = 'bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-2 py-1.5 text-[11px] font-mono text-[#F5F0E8] placeholder-[#6B6560] outline-none';
const BTN = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] hover:border-[#3D3B37] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default';

export default function StreamCountsPanel({ directive, updateDirective }) {
  const trackerId = directive.streamTrackerId;
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!trackerId) return;
    let cancelled = false;
    fetchStreamTracker(trackerId)
      .then(r => { if (!cancelled) { setReport(r); setError(null); } })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [trackerId]);

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

  if (!trackerId) return <StartTracking directive={directive} updateDirective={updateDirective} />;

  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-medium text-[#F5F0E8]">
            <Headphones size={12} className="text-[#DA7756]" />Streams
          </h3>
          <p className="text-[10px] text-[#6B6560] mt-0.5">
            {report ? `${report.title ? `${report.title} · ` : ''}campaign runs ${shortDay(report.startDate)} – ${shortDay(report.endDate)}, counted until ${shortDay(report.trackedUntil)}` : 'Loading…'}
          </p>
        </div>
        <button onClick={() => run(() => refreshStreamTracker(trackerId)).catch(() => {})} disabled={busy || !report} className={BTN} title="Read the counts now (normally once a day)">
          {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}Update
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[10px] text-[#C75F4F] mb-3"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}</p>
      )}

      {report && (
        <>
          {report.sources.length === 0 && (
            <p className="text-[10px] text-[#9B9590] mb-3">No links with a public count yet. Add the release's Spotify or YouTube link below.</p>
          )}
          <div className="space-y-3">
            {report.sources.map(s => (
              <SourceRow
                key={`${s.service}:${s.externalId}`}
                source={s}
                startDate={report.startDate}
                busy={busy}
                onCount={(day, count) => run(() => recordStreamCount(trackerId, { service: s.service, externalId: s.externalId, day, count }))}
                onRemove={() => run(() => removeStreamSource(trackerId, s.service, s.externalId)).catch(() => {})}
              />
            ))}
          </div>
          <AddSource busy={busy} onAdd={(url) => run(() => addStreamSource(trackerId, url))} />
          <Notes report={report} />
        </>
      )}
    </div>
  );
}

function SourceRow({ source: s, startDate, busy, onCount, onRemove }) {
  const [open, setOpen] = useState(false);
  const daily = s.daily || [];
  return (
    <div className="bg-[#0D0C0B] border border-[#2C2B28] rounded">
      <div className="flex items-center gap-3 p-3">
        <DspIcon service={s.service} size={14} />
        <div className="min-w-0 flex-1">
          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#F5F0E8] hover:text-[#DA7756]">
            {sourceLabel(s)}<ExternalLink size={9} />
          </a>
          <p className="text-[9px] font-mono text-[#6B6560]">{!s.auto ? 'Entered by hand' : s.service === 'youtube' ? 'Read daily from the YouTube API' : 'Read daily from the Spotify page'}</p>
        </div>
        <Figure label={s.baseline?.afterStart ? 'First count' : 'Before'} value={full(s.baseline?.count)} sub={s.baseline ? shortDay(s.baseline.day) : 'none yet'}
          hint={s.baseline?.afterStart ? 'Tracking started after the campaign began, so this is the first count, not a true before.' : 'The last count from before the campaign started.'} />
        <Figure label="Now" value={full(s.latest?.count)} sub={s.latest ? shortDay(s.latest.day) : '–'} />
        <Figure
          label="Gained in campaign"
          value={s.showGain ? signed(s.gain) : 'n/a'}
          sub={s.showGain ? '' : 'YouTube rules'}
          positive={s.gain > 0}
          hint={s.showGain ? undefined : "YouTube's API rules don't allow calculated figures like views gained until Prelude passes YouTube's analytics audit. Compare the daily views instead."}
        />
        <button onClick={() => setOpen(o => !o)} className="p-1 text-[#6B6560] hover:text-[#F5F0E8] cursor-pointer" title="Daily counts">
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {s.lastError && (
        <p className="flex items-start gap-1.5 text-[10px] text-[#D4A574] px-3 pb-2"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{s.lastError}</p>
      )}
      {s.manual && (!s.auto || s.lastError) && <CountForm busy={busy} onSave={onCount} />}

      {s.showGain && <StreamLift daily={daily} startDate={startDate} />}

      {open && (
        <div className="border-t border-[#2C2B28] p-3">
          {!s.showGain && daily.length > 1 && (
            <div className="h-36 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_STYLE} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatNumber} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} />
                  <Tooltip {...TOOLTIP_STYLE} labelFormatter={shortDay} formatter={(v) => [full(v), s.service === 'youtube' ? 'Views' : 'Plays']} />
                  <ReferenceLine x={daily.find(d => d.day >= startDate)?.day} stroke="#DA7756" strokeDasharray="3 3" label={{ value: 'Start', fill: '#DA7756', fontSize: 9, position: 'insideTopLeft' }} />
                  <Line type="monotone" dataKey="count" stroke="#DA7756" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {daily.length === 0 ? (
            <p className="text-[10px] text-[#6B6560]">No counts yet.</p>
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-[#6B6560]">
                  <th className="text-left font-normal pb-1">Day</th>
                  <th className="text-right font-normal pb-1">{s.service === 'youtube' ? 'Views' : 'Plays'}</th>
                  {s.showGain && <th className="text-right font-normal pb-1">Change</th>}
                  <th className="text-right font-normal pb-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map(d => (
                  <tr key={d.day} className="text-[#9B9590]">
                    <td className="py-0.5">{shortDay(d.day)}{d.day < startDate && <span className="text-[#6B6560]"> · before</span>}{d.afterEnd && <span className="text-[#6B6560]"> · after</span>}</td>
                    <td className="text-right text-[#F5F0E8]">{full(d.count)}</td>
                    {s.showGain && <td className={`text-right ${d.change > 0 ? 'text-[#7BAF73]' : ''}`}>{signed(d.change)}</td>}
                    <td className="text-right">{d.source === 'manual' ? 'by hand' : s.service === 'spotify' ? 'page' : 'API'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={onRemove} disabled={busy} className="mt-3 inline-flex items-center gap-1 text-[9px] font-mono text-[#6B6560] hover:text-[#C75F4F] cursor-pointer">
            <Trash2 size={9} />Stop tracking this link
          </button>
        </div>
      )}
    </div>
  );
}

const DAY_MS = 86400000;
const PHASE_COLOR = { before: '#6B6560', during: '#DA7756', after: '#9B9590' };
const PHASE_LABEL = { before: 'Before campaign', during: 'During campaign', after: 'After campaign' };

/** Streams per day from consecutive counts (a gap of several days is spread evenly). */
function perDay(daily, startDate) {
  const out = [];
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1], cur = daily[i];
    const days = Math.max(1, Math.round((Date.parse(cur.day) - Date.parse(prev.day)) / DAY_MS));
    out.push({
      day: cur.day,
      streams: Math.max(0, Math.round((cur.count - prev.count) / days)),
      phase: cur.afterEnd ? 'after' : cur.day < startDate ? 'before' : 'during',
    });
  }
  return out;
}

const avg = (rows) => (rows.length ? rows.reduce((t, r) => t + r.streams, 0) / rows.length : null);

/**
 * Streams per day as bars, grey before the campaign and orange during it, with a
 * headline saying whether daily streams went up compared with before.
 */
function StreamLift({ daily, startDate }) {
  const rows = perDay(daily, startDate);
  if (!rows.length) return null;
  const before = avg(rows.filter(r => r.phase === 'before'));
  const during = avg(rows.filter(r => r.phase === 'during'));
  const lift = before && during != null ? ((during - before) / before) * 100 : null;
  const up = lift != null && lift >= 5, down = lift != null && lift <= -5;
  const color = up ? '#7BAF73' : down ? '#C75F4F' : '#9B9590';
  const Icon = down ? TrendingDown : TrendingUp;
  const phases = [...new Set(rows.map(r => r.phase))];

  return (
    <div className="border-t border-[#2C2B28] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        {lift != null ? (
          <p className="flex items-center gap-1.5 text-sm" style={{ color }}>
            <Icon size={14} />
            <span className="font-mono">{lift >= 0 ? '+' : ''}{Math.round(lift)}%</span>
            <span className="text-[11px] text-[#9B9590]">
              streams per day: {formatNumber(Math.round(during))} during vs {formatNumber(Math.round(before))} before
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-[#9B9590]">
            {during != null ? `${formatNumber(Math.round(during))} streams per day during the campaign` : 'Streams per day'}
            {before == null && <span className="text-[#6B6560]"> · no counts from before the campaign to compare</span>}
          </p>
        )}
        <div className="flex gap-3">
          {phases.map(p => (
            <span key={p} className="flex items-center gap-1 text-[10px] text-[#9B9590]">
              <span className="w-2 h-2 rounded-sm" style={{ background: PHASE_COLOR[p] }} />{PHASE_LABEL[p]}
            </span>
          ))}
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} {...GRID_STYLE} />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatNumber} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#F5F0E8', opacity: 0.04 }} labelFormatter={shortDay}
              formatter={(v, n, item) => [full(v), `Streams (${PHASE_LABEL[item.payload.phase].toLowerCase()})`]} />
            {before != null && <ReferenceLine y={Math.round(before)} stroke="#9B9590" strokeDasharray="3 3" />}
            <Bar dataKey="streams" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {rows.map(r => <Cell key={r.day} fill={PHASE_COLOR[r.phase]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {before != null && <p className="text-[10px] text-[#6B6560] mt-1">Dashed line: daily average before the campaign.</p>}
    </div>
  );
}

function Figure({ label, value, sub, positive, hint }) {
  return (
    <div className="text-right w-24 shrink-0" title={hint}>
      <p className="text-[9px] font-mono text-[#6B6560]">{label}</p>
      <p className={`text-xs font-mono ${positive ? 'text-[#7BAF73]' : 'text-[#F5F0E8]'}`}>{value}</p>
      {sub && <p className="text-[9px] font-mono text-[#6B6560]">{sub}</p>}
    </div>
  );
}

function CountForm({ busy, onSave }) {
  const [day, setDay] = useState(todayIso);
  const [count, setCount] = useState('');
  const save = (e) => {
    e.preventDefault();
    if (!count.trim()) return;
    onSave(day, count).then(() => setCount('')).catch(() => {});
  };
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 px-3 pb-3">
      <input type="date" value={day} max={todayIso()} onChange={e => setDay(e.target.value)} className={inputCls} />
      <input value={count} onChange={e => setCount(e.target.value)} inputMode="numeric" placeholder="Play count, e.g. 1,204,331" className={`${inputCls} flex-1 min-w-[160px]`} />
      <button type="submit" disabled={busy || !count.trim()} className={BTN}>Save count</button>
    </form>
  );
}

function AddSource({ busy, onAdd }) {
  const [url, setUrl] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAdd(url.trim()).then(() => setUrl('')).catch(() => {});
  };
  return (
    <form onSubmit={add} className="flex items-center gap-2 mt-3">
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Add a Spotify track/album or YouTube video link" className={`${inputCls} flex-1`} />
      <button type="submit" disabled={busy || !url.trim()} className={BTN}><Plus size={10} />Add</button>
    </form>
  );
}

function Notes({ report }) {
  const notes = [];
  if (report.sources.some(s => s.service === 'youtube') && !report.youtube.configured) {
    notes.push('YouTube views can’t be read until YOUTUBE_API_KEY is set on the server.');
  }
  if (!notes.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {notes.map(n => (
        <p key={n} className="flex items-start gap-1.5 text-[9px] text-[#6B6560]"><Info size={9} className="mt-0.5 shrink-0" />{n}</p>
      ))}
    </div>
  );
}

// A campaign saved without stream tracking: start it from the release's smart link.
function StartTracking({ directive, updateDirective }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState(null);
  const [slug, setSlug] = useState(() => smartLinkSlug(directive.creative?.trackUrl) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || links) return;
    fetchSmartLinks()
      .then(({ links: all = [] }) => {
        const mine = all.filter(l => !directive.artistSlug || l.artistSlug === directive.artistSlug);
        setLinks(mine.length ? mine : all);
        setSlug(s => s || (mine[0] || all[0])?.slug || '');
      })
      .catch(e => { setLinks([]); setError(e.message); });
  }, [open, links, directive.artistSlug]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = `trk-${directive.id}`;
      await createStreamTracker({
        id, linkSlug: slug, artistSlug: directive.artistSlug, artistName: directive.artistName,
        startDate: directive.schedule?.startDate, endDate: directive.schedule?.endDate,
        campaigns: [directive],
      });
      updateDirective(directive.id, { streamTrackerId: id });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#171614] border border-[#2C2B28] rounded p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-medium text-[#F5F0E8]"><Headphones size={12} className="text-[#DA7756]" />Streams</h3>
          <p className="text-[10px] text-[#6B6560] mt-0.5">Track the release's Spotify and YouTube counts from before the campaign through every day of it.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className={BTN}>Track streams</button>}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {links === null ? (
            <Loader2 size={12} className="animate-spin text-[#6B6560]" />
          ) : links.length === 0 ? (
            <p className="text-[10px] text-[#9B9590]">Create a smart link for the release on the Links page first.</p>
          ) : (
            <>
              <select value={slug} onChange={e => setSlug(e.target.value)} className={`${inputCls} flex-1`}>
                {links.map(l => <option key={l.slug} value={l.slug}>{linkTitle(l)}</option>)}
              </select>
              <button onClick={start} disabled={busy || !slug} className={BTN}>
                {busy && <Loader2 size={10} className="animate-spin" />}Start tracking
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="flex items-start gap-1.5 text-[10px] text-[#C75F4F] mt-2"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}
