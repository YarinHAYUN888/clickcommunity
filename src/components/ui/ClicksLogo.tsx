import logoUrl from '@/assets/clicks-logo.png';

// Native logo dimensions (keep in sync with the source asset)
const NATIVE_W = 551;
const NATIVE_H = 453;
const ASPECT = NATIVE_W / NATIVE_H; // ~1.551

interface ClicksLogoProps {
  /** Rendered height in px. Width auto-scales to preserve native aspect ratio. */
  size?: number;
  className?: string;
  /** Show the "Clicks" wordmark next to the icon */
  showWordmark?: boolean;
  /** Wordmark color (CSS color). Defaults to currentColor */
  wordmarkColor?: string;
  /** Optional drop-shadow / glow under the logo */
  glow?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Central Clicks logo component. Always renders the source PNG at full quality
 * (622x401 native, RGBA) and lets the browser downscale via CSS for any target size.
 * Uses width/height attrs to prevent CLS and decoding="async" for perf.
 */
export default function ClicksLogo({
  size = 32,
  className = '',
  showWordmark = false,
  wordmarkColor,
  glow = false,
  onClick,
  ariaLabel = 'Clicks',
}: ClicksLogoProps) {
  const Tag: any = onClick ? 'button' : 'div';
  const wordmarkSize = Math.round(size * 0.85);
  // `size` represents rendered HEIGHT — width derived from native aspect
  const renderedH = size;
  const renderedW = Math.round(size * ASPECT);

  return (
    <Tag
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ lineHeight: 1 }}
    >
      <img
        src={logoUrl}
        alt={showWordmark ? '' : ariaLabel}
        aria-hidden={showWordmark || undefined}
        width={renderedW}
        height={renderedH}
        decoding="async"
        loading="eager"
        draggable={false}
        style={{
          width: renderedW,
          height: renderedH,
          objectFit: 'contain',
          imageRendering: 'auto',
          filter: glow ? 'drop-shadow(0 6px 20px rgba(124,58,237,0.35))' : undefined,
          userSelect: 'none',
        }}
      />
      {showWordmark && (
        <span
          className="font-extrabold tracking-tight"
          style={{
            fontSize: wordmarkSize,
            color: wordmarkColor ?? 'currentColor',
            letterSpacing: '-0.5px',
          }}
        >
          Clicks
        </span>
      )}
    </Tag>
  );
}