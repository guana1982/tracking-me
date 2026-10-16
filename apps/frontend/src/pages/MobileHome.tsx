import { Navigate } from 'react-router-dom';

function isMobileViewport(): boolean {
  // Same breakpoint as the app's mobile layout (Tailwind sm: = 640px)
  return window.matchMedia('(max-width: 639px)').matches;
}

/**
 * Index route gate. On the phone the diary is the page actually used every
 * day, so it opens straight there - finance stays one tap away in the bottom
 * nav. Desktop keeps landing on the budget dashboard.
 *
 * (This used to show a mode chooser on mobile; a chooser in front of the page
 * you open ten times a day is just a toll.)
 */
export function HomeGate() {
  return <Navigate to={isMobileViewport() ? '/food' : '/dashboard'} replace />;
}
