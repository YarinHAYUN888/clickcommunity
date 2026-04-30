import { cn } from '@/lib/utils';

interface InterestPillProps {
  label: string;
  emoji?: string;
  selected?: boolean;
  shared?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export default function InterestPill({ label, emoji, selected, shared, onClick, size = 'sm' }: InterestPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill font-medium transition-all',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
        selected || shared
          ? 'bg-primary text-primary-foreground shadow-glass'
          : 'bg-muted text-muted-foreground',
        onClick && 'cursor-pointer active:scale-95',
        !onClick && 'cursor-default'
      )}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  );
}
