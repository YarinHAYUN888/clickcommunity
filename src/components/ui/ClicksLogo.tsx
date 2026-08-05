import logoUrl from '@/assets/clicks-logo.png';
import logoTightUrl from '@/assets/clicks-logo-centered.png';

/**
 * `default` ships uneven transparent padding (58px left vs 35px right), so a perfectly
 * centred element still reads as shifted. `tight` is the same artwork with that border
 * removed, for layouts where optical centring matters.
 */
const VARIANTS = {
  default: { src: logoUrl, width: 551, height: 453 },
  tight: { src: logoTightUrl, width: 458, height: 407 },
} as const;

export type ClicksLogoVariant = keyof typeof VARIANTS;

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
  /** `tight` removes the asset's uneven transparent border so the artwork centres exactly. */
  variant?: ClicksLogoVariant;
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
  variant = 'default',
  onClick,
  ariaLabel = 'Clicks',
}: ClicksLogoProps) {
  const Tag: any = onClick ? 'button' : 'div';
  const asset = VARIANTS[variant];
  const wordmarkSize = Math.round(size * 0.85);
  // `size` represents rendered HEIGHT — width derived from native aspect
  const renderedH = size;
  const renderedW = Math.round(size * (asset.width / asset.height));

  return (
    <Tag
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ lineHeight: 1 }}
    >
      <img
        src={asset.src}
        alt={showWordmark ? '' : ariaLabel}
        aria-hidden={showWordmark || undefined}
        width={renderedW}
        height={renderedH}
        decoding="async"
        loading="eager"
        draggable={false}
        style={{
          display: 'block',
          width: renderedW,
          height: renderedH,
          marginInline: 'auto',
          objectFit: 'contain',
          objectPosition: 'center',
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