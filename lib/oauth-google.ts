import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

/**
 * Get the OAuth redirect URL for the current platform.
 * Native: phina://
 * Web: current origin (e.g. https://phina.appsmithery.co)
 */
export function getOAuthRedirectUrl(): string {
  return AuthSession.makeRedirectUri();
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
    console.error("[oauth-google] createSessionFromUrl error:", error);
    return null;
  }
}

/**
 * Sign in with Google using OAuth.
 * Opens an in-app browser, handles the redirect, and returns the session.
 * Returns null if the user cancels or an error occurs.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  try {
    const redirectUrl = getOAuthRedirectUrl();

    // Start OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) {
      console.error("[oauth-google] No OAuth URL returned");
      return null;
    }

    // Open in-app browser
    if (Platform.OS === "web") {
      // On web, we can't use openAuthSessionAsync reliably for all cases.
      // Instead, do a full redirect and handle the callback in a dedicated route.
      // For now, we'll attempt to use openAuthSessionAsync if available, but
      // the web callback route is the primary mechanism.
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      
      if (result.type === "success" && result.url) {
        return await createSessionFromUrl(result.url);
      }
      return null;
    } else {
      // Native: use openAuthSessionAsync
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === "success" && result.url) {
        return await createSessionFromUrl(result.url);
      } else if (result.type === "cancel") {
        console.log("[oauth-google] User cancelled");
        return null;
      } else {
        console.error("[oauth-google] Unexpected result type:", result.type);
        return null;
      }
    }
  } catch (error) {
    console.error("[oauth-google] signInWithGoogle error:", error);
    return null;
  }
}
