import {
  getPostAuthRouteFromProfile,
  resolvePostAuthRedirect,
  type PostAuthRoute,
} from '@/lib/routing/postAuthRedirect';
import type { SupabaseProfile } from '@/hooks/useCurrentUser';

export type { PostAuthRoute };

export async function getAuthenticatedEntryRoute(userId: string): Promise<PostAuthRoute> {
  const { route } = await resolvePostAuthRedirect(userId);
  return route;
}

export function getEntryRouteFromProfile(profile: SupabaseProfile | null): PostAuthRoute {
  return getPostAuthRouteFromProfile(profile);
}

/** Routes that must not mount MainLayout / SuitabilityGate before redirect. */
export function shouldBypassSuitabilityGate(pathname: string): boolean {
  if (pathname === '/pending-review' || pathname === '/blocked' || pathname === '/complete-profile') {
    return true;
  }
  if (pathname === '/login' || pathname === '/welcome' || pathname === '/') return true;
  if (pathname.startsWith('/onboarding')) return true;
  return false;
}
