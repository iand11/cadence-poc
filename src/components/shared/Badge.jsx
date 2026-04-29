import { cn } from '../../utils/cn';

const variantStyles = {
  success: 'bg-[#7BAF73]/15 text-[#7BAF73] border border-[#7BAF73]/30',
  warning: 'bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30',
  danger: 'bg-[#C75F4F]/15 text-[#C75F4F] border border-[#C75F4F]/30',
  info: 'bg-[#D4A574]/15 text-[#D4A574] border border-[#D4A574]/30',
};

export default function Badge({ variant = 'info', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
        variantStyles[variant]
      )}
    >
      {children}
    </span>
  );
}
