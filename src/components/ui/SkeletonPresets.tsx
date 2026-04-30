import { cn } from '@/lib/utils';

interface SkeletonProps {
  type?: 'text' | 'circle' | 'rect' | 'card';
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ type = 'text', width, height, className }: SkeletonProps) {
  const defaults = {
    text: { w: '100%', h: '16px', r: 'rounded-lg' },
    circle: { w: '48px', h: '48px', r: 'rounded-full' },
    rect: { w: '100%', h: '120px', r: 'rounded-2xl' },
    card: { w: '100%', h: '200px', r: 'rounded-2xl' },
  };
  const d = defaults[type];

  return (
    <div
      className={cn('skeleton-shimmer', d.r, className)}
      style={{ width: width || d.w, height: height || d.h }}
    />
  );
}

export function SkeletonProfileCard() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <Skeleton type="rect" height="200px" />
      <div className="p-4 space-y-3">
        <Skeleton type="text" width="60%" height="20px" />
        <Skeleton type="text" width="40%" height="14px" />
        <div className="flex gap-2">
          <Skeleton type="text" width="60px" height="28px" className="rounded-full" />
          <Skeleton type="text" width="72px" height="28px" className="rounded-full" />
          <Skeleton type="text" width="52px" height="28px" className="rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonEventCard() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <Skeleton type="rect" height="160px" />
      <div className="p-4 space-y-2">
        <Skeleton type="text" width="70%" height="18px" />
        <Skeleton type="text" width="50%" height="14px" />
        <Skeleton type="text" width="80%" height="8px" className="rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonChatRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton type="circle" width="48px" height="48px" />
      <div className="flex-1 space-y-2">
        <Skeleton type="text" width="40%" height="16px" />
        <Skeleton type="text" width="70%" height="12px" />
      </div>
    </div>
  );
}
