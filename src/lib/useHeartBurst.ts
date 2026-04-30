import { useState, useCallback } from 'react';

export interface HeartParticle {
  id: number;
  angle: number; // degrees
  distance: number;
}

export function useHeartBurst() {
  const [particles, setParticles] = useState<HeartParticle[]>([]);

  const burst = useCallback(() => {
    const id = Date.now();
    const next: HeartParticle[] = Array.from({ length: 4 }, (_, i) => ({
      id: id + i,
      angle: -90 + (i - 1.5) * 30 + (Math.random() - 0.5) * 12,
      distance: 28 + Math.random() * 14,
    }));
    setParticles((p) => [...p, ...next]);
    setTimeout(() => {
      setParticles((p) => p.filter((x) => !next.find((n) => n.id === x.id)));
    }, 700);
  }, []);

  return { particles, burst };
}