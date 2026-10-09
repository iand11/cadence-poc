import { DSP_ICON_PATHS } from '../../../api/lib/dsp-icons.js';
import { SERVICE_COLORS } from '../../data/smartLinks';

/** Streaming-service logo in its brand color (falls back to a dot for unknown services). */
export default function DspIcon({ service, size = 12, color, className = '' }) {
  const d = DSP_ICON_PATHS[service];
  const fill = color || SERVICE_COLORS[service] || '#DA7756';
  if (!d) return <span className={`inline-block rounded-full shrink-0 ${className}`} style={{ width: size * 0.7, height: size * 0.7, background: fill }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
