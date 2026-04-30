interface Props {
  topColor: string;
  bottomColor?: string;
  className?: string;
  flip?: boolean;
}

export default function WaveDivider({ topColor, className, flip }: Props) {
  return (
    <svg
      className={`block w-full ${className ?? ''}`}
      style={{ transform: flip ? 'scaleY(-1)' : undefined }}
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0,0 L0,40 C240,80 480,80 720,40 C960,0 1200,0 1440,40 L1440,0 Z"
        fill={topColor}
      />
    </svg>
  );
}