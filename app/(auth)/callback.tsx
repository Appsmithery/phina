import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { createSessionFromUrl } from "@/lib/oauth-google";
import { captureError } from "@/lib/observability";

const ALLOWED_NATIVE_SCHEMES = ["exp://", "phina://"];

/**
 * OAuth callback route for web.
 *
 * Two modes of operation:
 *
 * 1. **Web flow** (no nativeRedirect param): exchanges code/tokens for a Supabase
 *    session and navigates to /(tabs) within the web app.
 *
 * 2. **Native redirect intermediary** (nativeRedirect param present): forwards all
 *    auth params (code, access_token, etc.) to the native URL (exp:// or phina://).
 *    This is used by the Expo Go / native app browser fallback because Supabase
 *    doesn't reliably redirect to non-HTTP schemes. The in-app browser detects the
 *    scheme redirect and hands the URL back to the native app.
 */
export default function CallbackScreen() {
  const theme = useTheme();
  const { setSessionFromAuth } = useSupabase();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentUrl = new URL(window.location.href);
    const nativeRedirect = currentUrl.searchParams.get("nativeRedirect");

    // If this is a native redirect intermediary, forward auth params to the native URL.
    if (nativeRedirect && ALLOWED_NATIVE_SCHEMES.some((s) => nativeRedirect.startsWith(s))) {
      forwardToNativeApp(currentUrl, nativeRedirect);
      return;
    }

    // Standard web flow: exchange code/tokens for session.
    handleWebCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Redirect to the native app URL with all auth params attached. */
  function forwardToNativeApp(currentUrl: URL, nativeRedirect: string) {
    // Collect auth params from the query string (PKCE code) and hash fragment (implicit tokens).
    const hash = window.location.hash; // e.g. #access_token=...&refresh_token=...
    const code = currentUrl.searchParams.get("code");

    let targetUrl = nativeRedirect;

    if (hash && hash.length > 1) {
      // Implicit flow: tokens are in the fragment — append as-is.
      targetUrl += hash;
    } else if (code) {
      // PKCE flow: forward the authorization code as a query parameter.
      const separator = targetUrl.includes("?") ? "&" : "?";
      targetUrl += `${separator}code=${encodeURIComponent(code)}`;
    }

    console.log("[callback] Forwarding to native app:", targetUrl);
    window.location.href = targetUrl;
  }

  function safeNavigate(retries = 20, delay = 150) {
    try {
      router.replace("/");
    } catch (e) {
      if (retries > 0) {
        setTimeout(() => safeNavigate(retries - 1, delay), delay);
      } else {
        captureError(e instanceof Error ? e : new Error(String(e)));
        setError("Navigation failed — please refresh the page.");
      }
    }
  }

  async function handleWebCallback() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";

      if (!url) {
        setError("No URL found");
        return;
      }

      const session = await createSessionFromUrl(url);

      if (session) {
        setSessionFromAuth(session);
        safeNavigate();
      } else {
        setError("Failed to create session from callback");
      }
    } catch (err) {
      console.error("[callback] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Authentication Error</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>{error}</Text>
        <Text
          style={[styles.link, { color: theme.primary }]}
          onPress={() => router.replace("/(auth)")}
        >
          Return to sign in
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.message, { color: theme.text }]}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },
  link: {
    fontSize: 16,
    marginTop: 24,
    textDecorationLine: "underline",
  },
});
