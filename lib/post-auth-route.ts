import type { Session } from "@supabase/supabase-js";

import type { Member } from "@/types/database";

export const POST_AUTH_ROUTE = "/post-auth";

export type PostAuthDestination = "/(auth)" | "/onboarding" | "/(tabs)" | `/join/${string}`;

export function normalizeSafePostAuthRoute(route: string | null): string | null {
  if (!route || !route.startsWith("/") || route.startsWith("//")) {
    return null;
  }

  return route === "/" ? POST_AUTH_ROUTE : route;
}

export function resolvePostAuthDestination(params: {
  session: Session | null;
  member: Member | null;
  pendingJoinId: string | null;
}): PostAuthDestination {
  const { session, member, pendingJoinId } = params;

  if (!session) {
    return "/(auth)";
  }

  if (!member || !member.profile_complete) {
    return "/onboarding";
  }

  if (pendingJoinId) {
    return `/join/${pendingJoinId}`;
  }

  return "/(tabs)";
}
