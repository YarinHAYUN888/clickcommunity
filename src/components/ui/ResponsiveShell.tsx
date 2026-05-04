import { Outlet } from 'react-router-dom';
import PremiumBackground from './PremiumBackground';

/**
 * App shell for non-landing routes: shared background + outlet for matched route.
 */
export default function ResponsiveShell() {
  return (
    <div className="relative min-h-screen w-full">
      <PremiumBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
