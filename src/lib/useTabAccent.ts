import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Shifts the global mesh-gradient accent colors based on the active tab.
 * Updates --mesh-a / --mesh-b / --mesh-c CSS variables on documentElement.
 */
const ACCENTS: Record<string, [string, string, string]> = {
  '/clicks':       ['236, 72, 153',  '124, 58, 237',  '167, 139, 250'], // pink → purple
  '/events':       ['124, 58, 237',  '99, 102, 241',  '167, 139, 250'], // purple → blue
  '/chats':        ['99, 102, 241',  '124, 58, 237',  '139, 92, 246'],  // indigo
  '/profile':      ['124, 58, 237',  '167, 139, 250', '236, 72, 153'],
  '/subscription': ['147, 51, 234',  '124, 58, 237',  '167, 139, 250'],
  '/admin':        ['124, 58, 237',  '99, 102, 241',  '167, 139, 250'],
};
const DEFAULT: [string, string, string] = ['124, 58, 237', '167, 139, 250', '236, 72, 153'];

export function useTabAccent() {
  const location = useLocation();
  useEffect(() => {
    const key = Object.keys(ACCENTS).find(k => location.pathname.startsWith(k));
    const [a, b, c] = key ? ACCENTS[key] : DEFAULT;
    const root = document.documentElement;
    root.style.setProperty('--mesh-a', a);
    root.style.setProperty('--mesh-b', b);
    root.style.setProperty('--mesh-c', c);
  }, [location.pathname]);
}