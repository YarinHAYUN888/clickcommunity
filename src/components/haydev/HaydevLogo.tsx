import { cn } from '@/lib/utils';
import logoUrl from '@/assets/haydev-logo.png';

interface HaydevLogoProps {
  /** Fixed height in px; omit for responsive default sizing */
  size?: number;
  className?: string;
}

const ASPECT = 2.85;

/**
 * Official HAYDEV wordmark — PNG asset, scales cleanly on all breakpoints.
 */
export default function HaydevLogo({ size, className }: HaydevLogoProps) {
  const height = size ?? undefined;
  const width = size ? Math.round(size * ASPECT) : undefined;

  return (
    <img
      src={logoUrl}
      alt="HAYDEV"
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      className={cn(
        'select-none shrink-0 w-auto object-contain',
        !size && 'h-10 sm:h-12 md:h-14',
        className,
      )}
      style={
        size
          ? { height: size, width: Math.round(size * ASPECT) }
          : undefined
      }
    />
  );
}
