import { Link } from 'react-router';
import { PLATFORM_COLORS } from '../../constants/colors';

export default function ActionGroupHeader({ label, count, linkTo, platformColor }) {
  const color = platformColor || PLATFORM_COLORS[label?.toLowerCase()] || null;

  const content = (
    <div className="flex items-center gap-2 py-2 px-1">
      {color && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="text-xs font-medium text-[#F5F0E8] truncate">{label}</span>
      <span className="text-[10px] font-mono text-[#6B6560]">{count}</span>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block hover:text-[#DA7756] transition-colors">
        {content}
      </Link>
    );
  }

  return content;
}
