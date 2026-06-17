import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading', size = 'page' }) {
  const py = size === 'page' ? 'py-32' : 'py-12';
  return (
    <div className={`flex flex-col items-center justify-center ${py} text-center`}>
      <Loader2 size={20} className="animate-spin text-[#6B6560] mb-2" />
      <p className="text-xs text-[#6B6560]">{label}</p>
    </div>
  );
}
