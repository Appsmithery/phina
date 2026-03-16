import type { Session } from "@supabase/supabase-js";

export const NATIVE_MAGIC_LINK_REDIRECT_URL = "phina://auth/callback";
export const NATIVE_MAGIC_LINK_NEXT_ROUTE = "/(auth)/set-password";

type AuthCallbackSupabaseClient = {
  auth: {
    setSession: (session: { access_token: string; refresh_token: string }) => Promise<{
      data: { session: Session | null };
      error: Error | null;
    }>;
    exchangeCodeForSession: (code: string) => Promise<{
      data: { session: Session | null };
      error: Error | null;
    }>;
  };
};

let cachedSupabase: AuthCallbackSupabaseClient | null = null;

function getUrlSearchParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.replace(/^#/, "") || url.search.replace(/^\?/, ""));
}

function isSafeInternalRoute(route: string | null): route is string {
  return !!route && route.startsWith("/") && !route.startsWith("//");
}

function getSupabaseClient(): AuthCallbackSupabaseClient {
  if (!cachedSupabase) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedSupabase = require("./supabase").supabase as AuthCallbackSupabaseClient;
  }
  return cachedSupabase;
}

export function looksLikeAuthCallback(url: string): boolean {
  return url.includes("access_token") || url.includes("refresh_token") || url.includes("code=");
}

export function getPostAuthRouteFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const next = urlObj.searchParams.get("next");
    return isSafeInternalRoute(next) ? next : null;
  } catch {
    return null;
  }
}

export function buildNativeMagicLinkHandoffUrl(currentUrl: URL, nativeRedirect: string): string | null {
  if (nativeRedirect !== NATIVE_MAGIC_LINK_REDIRECT_URL) {
    return null;
  }

  const targetUrl = new URL(nativeRedirect);
  const currentParams = getUrlSearchParams(currentUrl);
  const accessToken = currentParams.get("access_token");
  const refreshToken = currentParams.get("refresh_token");
  const code = currentParams.get("code") ?? currentUrl.searchParams.get("code");
  const next = currentUrl.searchParams.get("next");

  if (accessToken && refreshToken) {
    targetUrl.hash = currentUrl.hash;
  } else if (code) {
    targetUrl.searchParams.set("code", code);
  }

  if (isSafeInternalRoute(next)) {
    targetUrl.searchParams.set("next", next);
  }

  return targetUrl.toString();
}

export async function createSessionFromUrl(url: string): Promise<Session | null> {
  try {
    const supabase = getSupabaseClient();
    const urlObj = new URL(url);
    const params = getUrlSearchParams(urlObj);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        throw error;
      }
      return data.session;
    }

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
      return data.session;
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.error("[auth-callback] createSessionFromUrl error:", error);
    }
    return null;
  }
}
