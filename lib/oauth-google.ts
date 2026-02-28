import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

// Attempt to load the native Google Sign-In module at runtime.
// This will succeed in production/dev builds but fail silently in Expo Go,
// which causes the browser-based fallback to be used automatically.
let GoogleSignin: {
  configure: (opts: { webClientId?: string; iosClientId?: string }) => void;
  hasPlayServices: () => Promise<void>;
  signIn: () => Promise<{ data?: { idToken?: string | null } | null }>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch {
  // Not available in Expo Go — browser fallback will be used
}

function isNativeGoogleAvailable(): boolean {
  return Platform.OS !== "web" && GoogleSignin != null;
}

/**
 * Get the OAuth redirect URL for the current platform.
 * Native: Uses AuthSession.makeRedirectUri() which handles Expo Go (exp://) vs standalone (phina://)
 * Web: current origin (e.g. https://phina.appsmithery.co)
 */
export function getOAuthRedirectUrl(): string {
  // makeRedirectUri() automatically handles:
  // - Expo Go: exp://...
  // - Standalone builds: phina://
  // - Web: current origin
  const redirectUri = AuthSession.makeRedirectUri();

  if (__DEV__) console.log("[oauth-google] Generated redirect URI:", redirectUri);
  return redirectUri;
}

/**
 * Parse tokens or code from the redirect URL and set the session.
 * Returns the session if successful, null otherwise.
 */
export async function createSessionFromUrl(url: string): Promise<Session | null> {
  try {
    // Parse URL params (could be in hash or query)
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.hash.replace("#", "") || urlObj.search.replace("?", ""));

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");

    if (accessToken && refreshToken) {
      // Implicit flow: tokens in URL
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data.session;
    } else if (code) {
      // PKCE flow: exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    }

    return null;
  } catch (error) {
    if (__DEV__) console.error("[oauth-google] createSessionFromUrl error:", error);
    return null;
  }
}

/**
 * Native sign-in path (production/dev builds only, not Expo Go).
 * Uses the Google Sign-In SDK to get an ID token, then exchanges it with Supabase.
 * No browser is opened — the user sees the native Google account picker.
 */
async function signInWithGoogleNative(): Promise<Session | null> {
  if (!GoogleSignin) throw new Error("GoogleSignin module not available");

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    if (__DEV__) console.log("[oauth-google] Native: no ID token returned (user may have cancelled)");
    return null;
  }

  if (__DEV__) console.log("[oauth-google] Native: received ID token, exchanging with Supabase");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) throw error;
  return data.session;
}

/**
 * Browser-based sign-in path (Expo Go fallback).
 *
 * Uses a two-hop redirect strategy because Supabase doesn't reliably redirect
 * to non-HTTP schemes like exp:// or phina://.
 *
 * Flow:
 * 1. Supabase redirects to https://phina.appsmithery.co/callback?nativeRedirect=exp://...
 * 2. The web callback page detects nativeRedirect and does window.location.href = "exp://...#tokens"
 * 3. ASWebAuthenticationSession (iOS) / Chrome Custom Tab (Android) detects the exp:// scheme
 * 4. Browser closes, returns the URL to the app
 * 5. createSessionFromUrl parses the tokens and sets the session
 */
async function signInWithGoogleBrowser(): Promise<Session | null> {
  const nativeRedirectUrl = getOAuthRedirectUrl(); // exp://192.168.x.x:8081 or phina://
  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

  // Use the web callback as an intermediary: Supabase redirects here (https:// URL it trusts),
  // then the callback page forwards auth params to the native exp:// or phina:// URL.
  const webCallbackUrl = `${appUrl}/callback?nativeRedirect=${encodeURIComponent(nativeRedirectUrl)}`;

  if (__DEV__) console.log("[oauth-google] Native redirect URL:", nativeRedirectUrl);
  if (__DEV__) console.log("[oauth-google] Web callback intermediary:", webCallbackUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: webCallbackUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    if (__DEV__) console.error("[oauth-google] Supabase signInWithOAuth error:", error);
    throw error;
  }

  if (!data?.url) {
    if (__DEV__) console.error("[oauth-google] No OAuth URL returned");
    return null;
  }

  if (__DEV__) console.log("[oauth-google] Opening OAuth URL in browser");

  if (Platform.OS === "web") {
    const result = await WebBrowser.openAuthSessionAsync(data.url, appUrl);
    if (result.type === "success" && result.url) {
      if (__DEV__) console.log("[oauth-google] Web auth success, processing URL");
      return await createSessionFromUrl(result.url);
    }
    if (__DEV__) console.log("[oauth-google] Web auth result:", result.type);
    return null;
  }

  // openAuthSessionAsync monitors for the exp:// (or phina://) scheme.
  // The web callback page will redirect to this URL with auth params attached.
  const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirectUrl);

  if (__DEV__) console.log("[oauth-google] Native browser result type:", result.type);

  if (result.type === "success" && result.url) {
    if (__DEV__) console.log("[oauth-google] Browser returned URL:", result.url);
    return await createSessionFromUrl(result.url);
  } else if (result.type === "cancel") {
    if (__DEV__) console.log("[oauth-google] Browser closed (cancel) — checking deep link fallback");
    return null;
  } else if (result.type === "dismiss") {
    if (__DEV__) console.log("[oauth-google] Browser dismissed before completing auth");
    return null;
  } else {
    if (__DEV__) console.error("[oauth-google] Unexpected result type:", result.type);
    return null;
  }
}

/**
 * Sign in with Google.
 *
 * - In production/dev native builds: uses the native Google Sign-In SDK (no browser).
 * - In Expo Go: falls back to in-app browser OAuth (browser closes after auth, session
 *   is set via deep link in app/_layout.tsx).
 * - On web: uses the browser OAuth flow.
 *
 * Returns the session on success, null if the user cancelled.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  try {
    if (isNativeGoogleAvailable()) {
      if (__DEV__) console.log("[oauth-google] Using native Google Sign-In (production build)");
      return await signInWithGoogleNative();
    }

    if (__DEV__) console.log("[oauth-google] Native SDK not available — using browser fallback (Expo Go)");
    return await signInWithGoogleBrowser();
  } catch (error) {
    if (__DEV__) console.error("[oauth-google] signInWithGoogle error:", error);
    return null;
  }
}
