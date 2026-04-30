import { useTabAccent } from '@/lib/useTabAccent';

/**
 * Multi-layer "Textured Depth" background.
 * Layers: gradient base + animated mesh blobs + dot pattern + noise.
 * Sits at z-0; content above must have its own stacking context.
 */
export default function PremiumBackground() {
  useTabAccent();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
      {/* Base soft gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, hsl(262 100% 97%) 0%, hsl(0 0% 100%) 50%, hsl(262 100% 96%) 100%)',
        }}
      />

      {/* Animated mesh blobs */}
      <div className="absolute inset-0">
        <div
          className="absolute animate-mesh-1"
          style={{
            top: '-15%',
            right: '-10%',
            width: '60%',
            height: '60%',
            background:
              'radial-gradient(circle at center, rgba(var(--mesh-a), 0.18) 0%, transparent 60%)',
            filter: 'blur(40px)',
            transition: 'background var(--mesh-transition) ease',
          }}
        />
        <div
          className="absolute animate-mesh-2"
          style={{
            bottom: '-15%',
            left: '-10%',
            width: '70%',
            height: '70%',
            background:
              'radial-gradient(circle at center, rgba(var(--mesh-b), 0.16) 0%, transparent 60%)',
            filter: 'blur(50px)',
            transition: 'background var(--mesh-transition) ease',
          }}
        />
        <div
          className="absolute animate-mesh-3"
          style={{
            top: '30%',
            left: '20%',
            width: '50%',
            height: '50%',
            background:
              'radial-gradient(circle at center, rgba(var(--mesh-c), 0.12) 0%, transparent 60%)',
            filter: 'blur(60px)',
            transition: 'background var(--mesh-transition) ease',
          }}
        />
      </div>

      {/* Dot pattern at corners (mask fades to center) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(124, 58, 237, 0.045) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, transparent 35%, black 90%)',
          maskImage:
            'radial-gradient(ellipse at center, transparent 35%, black 90%)',
        }}
      />

      {/* Noise grain */}
      <div className="absolute inset-0 bg-noise" />
    </div>
  );
}