import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { createSessionFromUrl } from "./auth-callback";

WebBrowser.maybeCompleteAuthSession();

// Attempt to load the native Google Sign-In module at runtime.
// This should succeed in dev/prod native builds when the plugin is present.
let GoogleSignin: {
  configure: (opts: { webClientId?: string; iosClientId?: string }) => void;
  hasPlayServices: () => Promise<void>;
  signIn: () => Promise<{ data?: { idToken?: string | null } | null }>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch {
  GoogleSignin = null;
}

function isNativeGoogleAvailable(): boolean {
  return Platform.OS !== "web" && GoogleSignin != null;
}

function canUseBrowserFallback(): boolean {
  return Platform.OS === "web" || isRunningInExpoGo();
}

/**
 * Get the OAuth redirect URL for the current platform.
 * Native: Uses AuthSession.makeRedirectUri() which handles Expo Go (exp://) vs standalone (phina://)
 * Web: current origin (e.g. https://phina.appsmithery.co)
 */
export function getOAuthRedirectUrl(): string {
  const redirectUri = AuthSession.makeRedirectUri();

  if (__DEV__) console.log("[oauth-google] Generated redirect URI:", redirectUri);
  return redirectUri;
}

/**
 * Native sign-in path (dev/prod native builds only).
 * Uses the Google Sign-In SDK to get an ID token, then exchanges it with Supabase.
 */
async function signInWithGoogleNative(): Promise<Session | null> {
  if (!GoogleSignin) throw new Error("GoogleSignin module not available");

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId || !iosClientId) {
    throw new Error(
      "Missing Google native client IDs. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before building iOS."
    );
  }

  if (__DEV__) {
    console.log("[oauth-google] Using native Google Sign-In SDK path", {
      platform: Platform.OS,
      expoGo: isRunningInExpoGo(),
      hasNativeModule: true,
    });
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId,
  });

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    if (__DEV__) console.log("[oauth-google] Native: no ID token returned");
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
 * Browser-based sign-in path (Expo Go fallback / web).
 */
async function signInWithGoogleBrowser(): Promise<Session | null> {
  const nativeRedirectUrl = getOAuthRedirectUrl();
  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";
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

  if (__DEV__) {
    console.log("[oauth-google] Using browser fallback path", {
      platform: Platform.OS,
      expoGo: isRunningInExpoGo(),
    });
  }

  if (Platform.OS === "web") {
    const result = await WebBrowser.openAuthSessionAsync(data.url, appUrl);
    if (result.type === "success" && result.url) {
      if (__DEV__) console.log("[oauth-google] Web auth success, processing URL");
      return await createSessionFromUrl(result.url);
    }
    if (__DEV__) console.log("[oauth-google] Web auth result:", result.type);
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirectUrl);

  if (__DEV__) console.log("[oauth-google] Native browser result type:", result.type);

  if (result.type === "success" && result.url) {
    if (__DEV__) console.log("[oauth-google] Browser returned URL:", result.url);
    return await createSessionFromUrl(result.url);
  }
  if (result.type === "cancel") {
    if (__DEV__) console.log("[oauth-google] Browser closed before completion");
    return null;
  }
  if (result.type === "dismiss") {
    if (__DEV__) console.log("[oauth-google] Browser dismissed before completion");
    return null;
  }

  if (__DEV__) console.error("[oauth-google] Unexpected result type:", result.type);
  return null;
}

/**
 * Sign in with Google.
 *
 * - Native dev/prod builds must use the native Google Sign-In SDK.
 * - Expo Go and web use the browser fallback flow.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  if (Platform.OS !== "web" && !isRunningInExpoGo()) {
    if (!isNativeGoogleAvailable()) {
      throw new Error(
        "Native Google Sign-In SDK is unavailable in this build. Rebuild the iOS dev client after confirming EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is set for the Google Sign-In plugin."
      );
    }

    if (__DEV__) console.log("[oauth-google] Using native Google Sign-In (dev/prod build)");
    return await signInWithGoogleNative();
  }

  if (!canUseBrowserFallback()) {
    throw new Error("Google sign-in browser fallback is not available in this environment");
  }

  if (__DEV__) console.log("[oauth-google] Using browser fallback (Expo Go or web)");
  return await signInWithGoogleBrowser();
}
