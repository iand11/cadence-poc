import { Check, Plus, X } from 'lucide-react';
import DspIcon from './DspIcon';
import { SERVICE_LABELS } from '../../data/smartLinks';

// The streaming-service links a smart link will show, after a lookup or entered by hand.
// links: { [service]: url } — a service with '' is a row waiting for a URL.
// found: services the lookup found, marked so the user can see what was discovered.

const inputCls = 'flex-1 min-w-0 bg-[#171614] border border-[#2C2B28] focus:border-[#DA7756]/50 rounded px-2 py-1.5 text-[11px] font-mono text-[#F5F0E8] placeholder-[#6B6560] outline-none';

export default function ServiceLinksEditor({ links, found, onChange }) {
  const services = Object.keys(SERVICE_LABELS);
  const shown = services.filter(s => s in links);
  const missing = services.filter(s => !(s in links));
  const set = (service, url) => onChange({ ...links, [service]: url });
  const remove = (service) => { const next = { ...links }; delete next[service]; onChange(next); };

  return (
    <div className="space-y-1.5">
      {shown.map(service => (
        <div key={service} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 w-28 shrink-0 text-[10px] text-[#F5F0E8]">
            <DspIcon service={service} size={11} />{SERVICE_LABELS[service]}
          </span>
          <input value={links[service]} onChange={e => set(service, e.target.value)} placeholder="https://…" className={inputCls} />
          {found?.has(service) && links[service]
            ? <span title="Found automatically" className="shrink-0"><Check size={11} className="text-[#7BAF73]" /></span>
            : <span className="w-[11px] shrink-0" />}
          <button onClick={() => remove(service)} title="Remove" className="text-[#6B6560] hover:text-[#C75F4F] cursor-pointer shrink-0"><X size={11} /></button>
        </div>
      ))}
      {missing.length > 0 && (
        <label className="flex items-center gap-1.5 text-[10px] text-[#DA7756]">
          <Plus size={10} />
          <select
            value=""
            onChange={e => e.target.value && set(e.target.value, '')}
            className="bg-transparent text-[10px] text-[#DA7756] outline-none cursor-pointer"
          >
            <option value="">Add a service{found ? ' that wasn\'t found' : ''}…</option>
            {missing.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
