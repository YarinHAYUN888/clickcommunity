import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CompatibilityArcProps {
  score: number;
  size?: 'sm' | 'lg';
  animate?: boolean;
}

export default function CompatibilityArc({ score, size = 'sm', animate = false }: CompatibilityArcProps) {
  const [visible, setVisible] = useState(!animate);
  const width = size === 'sm' ? 120 : 160;
  const height = size === 'sm' ? 60 : 80;
  const strokeWidth = 8;
  const radius = (width - strokeWidth) / 2;
  const centerX = width / 2;
  const centerY = height;
  const circumference = Math.PI * radius;
  const fillLength = (score / 100) * circumference;
  const gradId = `arc-grad-${size}`;

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    }
  }, [animate]);

  const arcPath = `M ${strokeWidth / 2} ${centerY} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${centerY}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="50%" stopColor="#9333EA" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        {/* Outer ghost arc (depth) */}
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          opacity={0.10}
        />
        {/* Mid ghost arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          opacity={0.18}
        />
        {/* Track */}
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--color-primary-ultra-light))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fill */}
        <motion.path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: visible ? circumference - fillLength : circumference }}
          transition={{ duration: 1.0, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-10" style={{ marginTop: size === 'sm' ? -38 : -50 }}>
        <span
          className="font-extrabold text-gradient-premium"
          style={{ fontSize: size === 'sm' ? 20 : 24 }}
        >
          {score}%
        </span>
        <span
          className="text-muted-foreground"
          style={{ fontSize: size === 'sm' ? 11 : 12 }}
        >
          התאמה
        </span>
      </div>
    </div>
  );
}
