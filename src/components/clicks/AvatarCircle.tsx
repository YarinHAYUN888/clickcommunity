import { cn } from '@/lib/utils';

interface AvatarCircleProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export default function AvatarCircle({ src, alt, size = 'md', isOnline, className, onClick }: AvatarCircleProps) {
  return (
    <div className={cn('relative inline-block', onClick && 'cursor-pointer', className)} onClick={onClick}>
      <img
        src={src}
        alt={alt}
        className={cn('rounded-full object-cover border-2 border-card', sizeMap[size])}
      />
      {isOnline && (
        <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-success border-2 border-card" />
      )}
    </div>
  );
}
