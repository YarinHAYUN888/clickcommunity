import { ReactNode, CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  gradient?: string;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

export default function GradientText({
  children,
  gradient = 'linear-gradient(135deg, #A78BFA, #EC4899)',
  className,
  style,
  as: Tag = 'span',
}: Props) {
  return (
    <Tag
      className={className}
      style={{
        backgroundImage: gradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}