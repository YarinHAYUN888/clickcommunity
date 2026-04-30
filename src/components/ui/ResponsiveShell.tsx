import { ReactNode } from 'react';
import PremiumBackground from './PremiumBackground';

interface ResponsiveShellProps {
  children: ReactNode;
}

export default function ResponsiveShell({ children }: ResponsiveShellProps) {
  return (
    <div className="relative min-h-screen w-full">
      <PremiumBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
