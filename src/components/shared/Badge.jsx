import { cn } from '../../utils/cn';

const variantStyles = {
  success: 'bg-[#7ab87a]/15 text-[#7ab87a] border border-[#7ab87a]/30',
  warning: 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30',
  danger: 'bg-[#e85d5d]/15 text-[#e85d5d] border border-[#e85d5d]/30',
  info: 'bg-[#5b9bd5]/15 text-[#5b9bd5] border border-[#5b9bd5]/30',
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
