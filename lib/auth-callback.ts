import type { Session } from "@supabase/supabase-js";
import { normalizeSafePostAuthRoute } from "./post-auth-route";

export const NATIVE_MAGIC_LINK_REDIRECT_URL = "phina://auth/callback";
export const NATIVE_MAGIC_LINK_NEXT_ROUTE = "/(auth)/set-password";
export type AuthCallbackResolutionOutcome = "created" | "existing" | "missing" | "unresolved";

export type AuthCallbackResolution = {
  session: Session | null;
  outcome: AuthCallbackResolutionOutcome;
};

const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

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
    verifyOtp: (params: { token_hash: string; type: EmailOtpType }) => Promise<{
      data: { session: Session | null };
      error: Error | null;
    }>;
    getSession: () => Promise<{
      data: { session: Session | null };
      error: Error | null;
    }>;
  };
};

let cachedSupabase: AuthCallbackSupabaseClient | null = null;

function getUrlSearchParams(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search.replace(/^\?/, ""));
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  hashParams.forEach((value, key) => {
    merged.set(key, value);
  });
  return merged;
}

function getEmailOtpType(params: URLSearchParams): EmailOtpType | null {
  const type = params.get("type");
  return type && EMAIL_OTP_TYPES.includes(type as EmailOtpType) ? (type as EmailOtpType) : null;
}

function getSupabaseClient(): AuthCallbackSupabaseClient {
  if (!cachedSupabase) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedSupabase = require("./supabase").supabase as AuthCallbackSupabaseClient;
  }
  return cachedSupabase;
}

export function isAuthCallbackRoute(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const normalizedPath = urlObj.pathname.replace(/\/+$/, "") || "/";
    return normalizedPath === "/callback";
  } catch {
    return url.includes("/callback") || url.includes("://auth/callback");
  }
}

export function looksLikeAuthCallback(url: string): boolean {
  try {
    const params = getUrlSearchParams(new URL(url));
    return Boolean(
      params.get("access_token") ||
        params.get("refresh_token") ||
        params.get("code") ||
        (params.get("token_hash") && getEmailOtpType(params))
    );
  } catch {
    return (
      url.includes("access_token") ||
      url.includes("refresh_token") ||
      url.includes("code=") ||
      (url.includes("token_hash=") && url.includes("type="))
    );
  }
}

export function getPostAuthRouteFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return normalizeSafePostAuthRoute(urlObj.searchParams.get("next"));
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
  const code = currentParams.get("code");
  const tokenHash = currentParams.get("token_hash");
  const type = getEmailOtpType(currentParams);
  const next = normalizeSafePostAuthRoute(currentUrl.searchParams.get("next"));

  if (accessToken && refreshToken) {
    targetUrl.hash = currentUrl.hash;
  } else if (code) {
    targetUrl.searchParams.set("code", code);
  } else if (tokenHash && type) {
    targetUrl.searchParams.set("token_hash", tokenHash);
    targetUrl.searchParams.set("type", type);
  }

  if (next) {
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
    const tokenHash = params.get("token_hash");
    const type = getEmailOtpType(params);

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

    if (tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
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

export async function resolveSessionFromUrl(url: string): Promise<AuthCallbackResolution> {
  const createdSession = await createSessionFromUrl(url);
  if (createdSession) {
    return { session: createdSession, outcome: "created" };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    if (data.session) {
      return { session: data.session, outcome: "existing" };
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[auth-callback] resolveSessionFromUrl getSession error:", error);
    }
  }

  return {
    session: null,
    outcome: looksLikeAuthCallback(url) ? "unresolved" : "missing",
  };
}
