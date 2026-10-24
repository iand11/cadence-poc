import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, RefreshCw, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { fetchDataHealth } from '../data/adminHealth';
import { formatNumber, formatAgo } from '../utils/formatters';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../utils/chartTheme';
import LoadingState from '../components/shared/LoadingState';

// Freshness bands, newest → oldest: one hue stepping darker, grey for never refreshed
const BAND = ['#DA7756', '#A65A42', '#70402F', '#45291F'];
const NEVER = '#3D3B37';
const STATUS = { ok: '#7BAF73', warn: '#D4A574', bad: '#C75F4F' };

const num = (v) => (v == null ? '—' : formatNumber(v));
const ago = (t) => (t ? formatAgo(t) : 'never');
const pct = (a, b) => (a == null || !b ? '—' : `${Math.round((a / b) * 100)}%`);
const hours = (t) => (t ? (Date.now() - Date.parse(t)) / 3_600_000 : Infinity);
const bytes = (b) => (b == null ? '—' : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const shortDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Admin-only data health: catalog freshness, crawls, jobs and pipelines (GET /api/admin/health). */
export default function AdminDataPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((fresh = false) => {
    fetchDataHealth({ fresh })
      .then((d) => { setData(d); setError(null); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  // Share of the catalog refreshed in the 24h before each daily snapshot
  const trend = useMemo(() => (data?.history || []).map((h) => ({
    day: h.day,
    artists: h.artists ? +((h.artistsFresh24h / h.artists) * 100).toFixed(1) : null,
    playlists: h.playlistsActive ? +((h.playlistsCrawled24h / h.playlistsActive) * 100).toFixed(1) : null,
  })).filter((h) => h.artists != null || h.playlists != null), [data]);

  if (!data && loading) return <LoadingState label="Checking data" />;
  if (!data) return <p className="py-32 text-center text-xs text-[#9B9590]">{error?.message || 'Unavailable'}</p>;

  const a = data.artists, p = data.playlists;
  const jobsBad = (data.jobs || []).filter((j) => j.ok === false || (j.daily && hours(j.lastRun) > 26)).length;
  const queue = a.queue?.byStatus || {};

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-16">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
          <Activity size={15} className="text-[#DA7756]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-medium text-[#F5F0E8]">Data health</h2>
          <p className="text-[10px] font-mono text-[#6B6560]">Updated {ago(data.generatedAt)}</p>
        </div>
        <button onClick={() => { setLoading(true); load(true); }} disabled={loading} title="Refresh"
          className="p-2 rounded border border-[#2C2B28] text-[#9B9590] hover:text-[#F5F0E8] disabled:opacity-50 cursor-pointer">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <Alerts alerts={data.alerts} missingIndexes={data.missingIndexes} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Tile label="Artists" value={num(a.total)} sub={`${pct(a.fresh?.d7, a.total)} < 7d`} level={a.newest && hours(a.newest) > 48 ? 'bad' : null} />
        <Tile label="Playlists" value={num(p.active)} sub={`${pct(p.fresh?.d1, p.active)} < 24h`} level={(p.platforms || []).some((x) => hours(x.newest) > 48) ? 'bad' : null} />
        <Tile label="Followed stale" value={a.followed ? num(a.followed.stale + a.followed.never) : '—'} sub={`of ${num(a.followed?.artists)}`}
          level={a.followed?.never ? 'bad' : a.followed?.stale ? 'warn' : 'ok'} />
        <Tile label="Queue" value={num(queue.pending?.n || 0)} sub={`${num(a.queue?.last24h?.failed || 0)} failed 24h`}
          level={a.queue?.last24h?.failed ? 'warn' : null} />
        <Tile label="Jobs" value={jobsBad ? `${jobsBad} late/failed` : 'OK'} sub={`${data.jobs?.length || 0} tracked`} level={jobsBad ? 'bad' : 'ok'} />
      </div>

      <Section title="Artists" right={`newest ${ago(a.newest)} · oldest ${ago(a.oldest)}`}>
        <FreshBar segments={a.fresh ? [
          { label: '24h', n: a.fresh.d1 },
          { label: '7d', n: a.fresh.d7 - a.fresh.d1 },
          { label: '30d', n: a.fresh.d30 - a.fresh.d7 },
          { label: 'Older', n: a.fresh.older },
          { label: 'Never', n: a.never, never: true },
        ] : null} />
        <div className="grid md:grid-cols-[1fr_260px] gap-4 mt-4">
          <div>
            <Caption>Last refresh, by day</Caption>
            <DayBars end={data.generatedAt} data={a.days} />
          </div>
          <div className="space-y-1.5">
            <Kv k="Added 24h / 7d" v={a.added ? `${num(a.added.d1)} / ${num(a.added.d7)}` : '—'} />
            <Kv k="Posts fetched 24h" v={num(a.posts?.d1)} />
            <Kv k="Posts last fetch" v={ago(a.posts?.newest)} />
            <Kv k="Followed / users" v={a.followed ? `${num(a.followed.artists)} / ${num(a.followed.users)}` : '—'} />
            <Kv k="Requests pending" v={num(a.requests?.pending?.n || 0)} sub={a.requests?.pending ? ago(a.requests.pending.oldest) : null} />
          </div>
        </div>
        {a.stalest?.length > 0 && (
          <div className="mt-4">
            <Caption>Stalest followed</Caption>
            <div className="grid sm:grid-cols-2 gap-x-6">
              {a.stalest.map((s) => (
                <div key={s.slug} className="flex items-center justify-between py-1 text-xs border-b border-[#2C2B28]/60">
                  <a href={`/app/artist/${s.slug}`} className="text-[#F5F0E8] truncate hover:text-[#DA7756]">{s.name}</a>
                  <span className={`font-mono text-[10px] ${hours(s.as_of) > data.thresholds.artistStaleDays * 24 ? 'text-[#C75F4F]' : 'text-[#9B9590]'}`}>{ago(s.as_of)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Playlists" right={`~${num(p.inactive)} inactive`}>
        <FreshBar segments={p.fresh ? [
          { label: '24h', n: p.fresh.d1 },
          { label: `${data.thresholds.playlistStaleDays}d`, n: p.fresh.recent - p.fresh.d1 },
          { label: '30d', n: p.fresh.d30 - p.fresh.recent },
          { label: 'Older', n: p.active - p.fresh.d30 - p.fresh.never },
          { label: 'Never', n: p.fresh.never, never: true },
        ] : null} />
        <div className="grid md:grid-cols-[1fr_260px] gap-4 mt-4">
          <div>
            <Caption>Last crawl, by day</Caption>
            <DayBars end={data.generatedAt} data={p.days} />
          </div>
          <div className="space-y-1.5">
            <Kv k="Entries added 24h / 7d" v={`${num(p.entries.added24h)} / ${num(p.entries.added7d)}`} />
            <Kv k="Entries total" v={`~${num(p.entries.estimated)}`} />
            <Kv k="Playlists changed 24h" v={num(p.changed24h)} />
            {(data.rollups || []).map((r) => <Kv key={r.key} k={`Rollup: ${r.key}`} v={ago(r.refreshedAt)} />)}
          </div>
        </div>
        {p.platforms && (
          <Table className="mt-4" head={['Platform', 'Active', '< 24h', 'Stale', 'Last crawl']}
            rows={p.platforms.map((x) => [
              x.platform, num(x.active), pct(x.d1, x.active),
              <span key="s" className={x.active - x.fresh > 0 ? 'text-[#D4A574]' : ''}>{num(x.active - x.fresh)}</span>,
              <span key="l" className={hours(x.newest) > 48 ? 'text-[#C75F4F]' : ''}>{ago(x.newest)}</span>,
            ])} />
        )}
        {p.types?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.types.map((t) => (
              <span key={t.type} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D0C0B] border border-[#2C2B28] text-[#9B9590]">
                {t.type || 'other'} {num(t.n)}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Jobs">
        {data.jobs?.length ? (
          <div className="divide-y divide-[#2C2B28]/60">
            {data.jobs.map((j) => {
              const late = j.daily && hours(j.lastRun) > 26;
              const level = j.ok === false || (late && j.lastRun) ? 'bad' : late ? 'warn' : j.ok ? 'ok' : 'warn';
              return (
                <div key={j.job} className="flex items-center gap-3 py-2 text-xs">
                  <StatusIcon level={level} />
                  <span className="text-[#F5F0E8] w-36 truncate">{j.job}</span>
                  <span className="flex gap-0.5 flex-1">
                    {j.recent.map((r, i) => (
                      <span key={i} title={new Date(r.at).toLocaleString()} className="w-1.5 h-3 rounded-sm"
                        style={{ background: r.ok === false ? STATUS.bad : r.ok ? STATUS.ok : NEVER }} />
                    ))}
                  </span>
                  <span className="font-mono text-[10px] text-[#9B9590] w-20 text-right">
                    {j.lastRun && j.finishedAt ? `${Math.max(1, Math.round((Date.parse(j.finishedAt) - Date.parse(j.lastRun)) / 1000))}s` : ''}
                  </span>
                  <span className={`font-mono text-[10px] w-20 text-right ${level === 'bad' ? 'text-[#C75F4F]' : 'text-[#9B9590]'}`}>{ago(j.lastRun)}</span>
                </div>
              );
            })}
            {data.jobs.filter((j) => j.ok === false && j.error).map((j) => (
              <p key={`${j.job}-err`} className="py-1.5 text-[10px] font-mono text-[#C75F4F] truncate" title={j.error}>{j.job}: {j.error}</p>
            ))}
          </div>
        ) : <Empty />}
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Refresh queue">
          <div className="grid grid-cols-4 gap-2">
            {['pending', 'in_progress', 'failed', 'done'].map((s) => <Mini key={s} k={s.replace('_', ' ')} v={num(queue[s]?.n || 0)} />)}
          </div>
          <div className="mt-3 space-y-1.5">
            <Kv k="Oldest pending" v={queue.pending ? ago(queue.pending.oldest) : '—'} />
            <Kv k="Done / failed 24h" v={a.queue?.last24h ? `${num(a.queue.last24h.done)} / ${num(a.queue.last24h.failed)}` : '—'} />
            <Kv k="Stuck > 1h" v={num(a.queue?.last24h?.stuck || 0)} />
          </div>
          <Errors rows={(a.queue?.errors || []).map((e) => ({ key: e.error, text: e.error, n: e.n }))} />
        </Section>

        <Section title={data.streams.followerTracking ? 'Stream + follower counts' : 'Stream counts'}
          right={data.streams.trackers ? `${num(data.streams.trackers.active)} campaigns · ${ago(data.streams.trackers.last_run)}` : null}>
          {data.streams.services?.length ? (
            <Table head={['Source', 'Tracked', 'Current', 'Failing', 'Last day']}
              rows={data.streams.services.map((s) => [
                s.service, num(s.sources), pct(s.current, s.sources),
                <span key="f" className={s.failing ? 'text-[#C75F4F]' : ''}>{num(s.failing)}</span>,
                s.last_day ? shortDay(String(s.last_day).slice(0, 10)) : '—',
              ])} />
          ) : <Empty />}
          {data.streams.sources7d && (
            <p className="mt-2 text-[10px] font-mono text-[#6B6560]">
              7d: {Object.entries(data.streams.sources7d).map(([k, v]) => `${k} ${num(v)}`).join(' · ')}
            </p>
          )}
          <Errors rows={(data.streams.errors || []).map((e, i) => ({ key: i, text: `${e.service} · ${e.title || e.label}: ${e.error}` }))} />
        </Section>

        <Section title="Campaign reports">
          <div className="grid grid-cols-3 gap-2">
            <Mini k="tracked" v={num(data.reports.due)} />
            <Mini k="saved today" v={num(data.reports.today)} level={data.reports.due && !data.reports.today ? 'warn' : null} />
            <Mini k="awaiting review" v={num(data.reports.managedReview)} level={data.reports.managedReview ? 'warn' : null} />
          </div>
          <div className="mt-3 space-y-1.5">
            <Kv k="Saved yesterday" v={num(data.reports.yesterday)} />
            <Kv k="Last saved" v={ago(data.reports.newest)} />
          </div>
        </Section>

        <Section title="Spotify fans">
          <div className="grid grid-cols-4 gap-2">
            <Mini k="fans" v={num(data.fans?.total)} />
            <Mini k="stale 24h" v={num(data.fans?.stale)} level={data.fans?.stale ? 'warn' : null} />
            <Mini k="failing" v={num(data.fans?.failing)} level={data.fans?.failing ? 'bad' : null} />
            <Mini k="revoked" v={num(data.fans?.revoked)} />
          </div>
          <div className="mt-3 space-y-1.5">
            <Kv k="Last sync" v={ago(data.fans?.last_sync)} />
            <Kv k="Newest play" v={ago(data.fans?.last_play)} />
          </div>
        </Section>

        <Section title="Smart links" right={data.links ? `${num(data.links.links)} links · ${num(data.links.fans)} fans` : null}>
          <Caption>Clicks per day · last event {ago(data.links?.last_event)}</Caption>
          <DayBars end={data.generatedAt} data={data.links?.days?.map((d) => ({ day: d.day, n: d.clicks }))} />
        </Section>

        <Section title="Connections">
          {data.connections?.length ? (
            <Table head={['Platform', 'Connected', 'Expired', 'Expiring 7d']}
              rows={data.connections.map((c) => [c.platform, num(c.n),
                <span key="e" className={c.expired ? 'text-[#C75F4F]' : ''}>{num(c.expired)}</span>, num(c.expiring)])} />
          ) : <Empty />}
          <div className="mt-3"><Kv k="Notifications undelivered > 1d" v={num(data.notifications?.undelivered)} /></div>
        </Section>
      </div>

      {trend.length > 1 && (
        <Section title="Refreshed in 24h" right="% of catalog, daily">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_STYLE} vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={40} domain={[0, 'auto']} />
              <Tooltip {...TOOLTIP_STYLE} labelFormatter={shortDay} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="artists" name="Artists" stroke={BAND[0]} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="playlists" name="Playlists" stroke="#F5F0E8" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 text-[10px] text-[#9B9590]">
            <Legend color={BAND[0]} label="Artists" />
            <Legend color="#F5F0E8" label="Playlists" />
          </div>
        </Section>
      )}

      <Section title="Storage">
        <Table head={['Table', 'Rows (est.)', 'Size']} rows={(data.tables || []).slice(0, 8).map((t) => [t.name, num(t.rows), bytes(t.bytes)])} />
      </Section>
    </motion.div>
  );
}

function Alerts({ alerts, missingIndexes }) {
  const [open, setOpen] = useState(false);
  if (!alerts?.length) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#7BAF73]/30 bg-[#7BAF73]/5 text-xs text-[#7BAF73]">
        <CheckCircle2 size={13} /> All clear
      </div>
    );
  }
  return (
    <div className="rounded border border-[#2C2B28] bg-[#171614] divide-y divide-[#2C2B28]/60">
      {(open ? alerts : alerts.slice(0, 4)).map((al, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
          <StatusIcon level={al.level} />
          <span className="text-[#6B6560] w-24 shrink-0">{al.area}</span>
          <span className="text-[#F5F0E8]">{al.text}</span>
        </div>
      ))}
      {alerts.length > 4 && (
        <button onClick={() => setOpen(!open)} className="w-full px-3 py-1.5 text-left text-[10px] font-mono text-[#9B9590] hover:text-[#F5F0E8] cursor-pointer">
          {open ? 'Less' : `+${alerts.length - 4} more`}
        </button>
      )}
      {missingIndexes?.length > 0 && (
        <p className="px-3 py-1.5 text-[10px] font-mono text-[#6B6560]">npm run db:diagnose -- --apply-indexes · {missingIndexes.join(', ')}</p>
      )}
    </div>
  );
}

function StatusIcon({ level }) {
  if (level === 'bad') return <XCircle size={13} className="shrink-0" style={{ color: STATUS.bad }} aria-label="failing" />;
  if (level === 'warn') return <AlertTriangle size={13} className="shrink-0" style={{ color: STATUS.warn }} aria-label="warning" />;
  return <CheckCircle2 size={13} className="shrink-0" style={{ color: STATUS.ok }} aria-label="ok" />;
}

function Section({ title, right, children }) {
  return (
    <section className="rounded border border-[#2C2B28] bg-[#171614] p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h3 className="text-xs font-medium text-[#F5F0E8]">{title}</h3>
        {right && <span className="text-[10px] font-mono text-[#6B6560] truncate">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, level }) {
  return (
    <div className="rounded border border-[#2C2B28] bg-[#171614] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#6B6560]">{label}</span>
        {level && <StatusIcon level={level} />}
      </div>
      <p className="text-lg font-mono text-[#F5F0E8] mt-0.5">{value}</p>
      <p className="text-[10px] font-mono text-[#9B9590]">{sub}</p>
    </div>
  );
}

function Mini({ k, v, level }) {
  return (
    <div className="rounded bg-[#0D0C0B] border border-[#2C2B28] px-2 py-1.5">
      <p className="text-sm font-mono" style={{ color: level ? STATUS[level] : '#F5F0E8' }}>{v}</p>
      <p className="text-[9px] text-[#6B6560]">{k}</p>
    </div>
  );
}

function Kv({ k, v, sub }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#9B9590]">{k}</span>
      <span className="font-mono text-[#F5F0E8]">{v}{sub && <span className="text-[#6B6560] ml-1.5 text-[10px]">{sub}</span>}</span>
    </div>
  );
}

const Caption = ({ children }) => <p className="text-[10px] text-[#6B6560] mb-1.5">{children}</p>;
const Empty = () => <p className="text-xs text-[#6B6560]">—</p>;
const Legend = ({ color, label }) => (
  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}</span>
);

/** Stacked freshness bar (newest → never) with a counted legend. */
function FreshBar({ segments }) {
  if (!segments) return <Empty />;
  const segs = segments.map((s) => ({ ...s, n: Math.max(0, s.n || 0) }));
  const total = segs.reduce((t, s) => t + s.n, 0);
  let band = 0;
  const colored = segs.map((s) => ({ ...s, color: s.never ? NEVER : BAND[band++] }));
  return (
    <div>
      <div className="flex h-3 gap-[2px] rounded overflow-hidden bg-[#0D0C0B]">
        {total > 0 && colored.filter((s) => s.n > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.n.toLocaleString()}`} style={{ width: `${(s.n / total) * 100}%`, background: s.color, minWidth: 2 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-[#9B9590]">
        {colored.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <span className="font-mono text-[#F5F0E8]">{formatNumber(s.n)}</span>
            <span className="font-mono text-[#6B6560]">{pct(s.n, total)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Last 30 days as bars, missing days filled with 0. */
function DayBars({ data, end }) {
  if (!data) return <Empty />;
  const byDay = new Map(data.map((d) => [d.day, d.n]));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.parse(end) - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day: d, n: byDay.get(d) || 0 });
  }
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={days} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
        <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={32} />
        <YAxis hide />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#2C2B28' }} labelFormatter={shortDay} formatter={(v) => [v.toLocaleString(), 'Count']} />
        <Bar dataKey="n" fill={BAND[0]} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Table({ head, rows, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-[#6B6560]">
            {head.map((h, i) => <th key={h} className={`font-normal pb-1.5 ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#2C2B28]/60">
              {r.map((c, j) => <td key={j} className={`py-1.5 ${j ? 'text-right font-mono text-[#9B9590]' : 'text-[#F5F0E8]'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Errors({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {rows.map((r) => (
        <p key={r.key} className="text-[10px] font-mono text-[#C75F4F] truncate" title={r.text}>
          {r.n ? `${r.n}× ` : ''}{r.text}
        </p>
      ))}
    </div>
  );
}
