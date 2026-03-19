import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { buildNativeMagicLinkHandoffUrl, createSessionFromUrl } from "@/lib/auth-callback";
import { captureError } from "@/lib/observability";
import { POST_AUTH_ROUTE } from "@/lib/post-auth-route";

/**
 * Auth callback route for web.
 *
 * Two modes of operation:
 *
 * 1. Web flow (no nativeRedirect param): exchanges code/tokens for a Supabase
 *    session and navigates within the web app.
 * 2. Native redirect intermediary (nativeRedirect param present): forwards auth
 *    params plus the desired post-auth route back to the native app.
 */
export default function CallbackScreen() {
  const theme = useTheme();
  const { setSessionFromAuth } = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const [nativeAppUrl, setNativeAppUrl] = useState<string | null>(null);
  const [showNativeFallback, setShowNativeFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const nativeRedirect = currentUrl.searchParams.get("nativeRedirect");
    let fallbackTimeout: number | null = null;

    if (nativeRedirect) {
      fallbackTimeout = forwardToNativeApp(currentUrl, nativeRedirect);
    } else {
      handleWebCallback();
    }

    return () => {
      if (fallbackTimeout !== null) {
        window.clearTimeout(fallbackTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function forwardToNativeApp(currentUrl: URL, nativeRedirect: string): number | null {
    const targetUrl = buildNativeMagicLinkHandoffUrl(currentUrl, nativeRedirect);
    if (!targetUrl) {
      setError("Invalid native redirect target");
      return null;
    }

    setNativeAppUrl(targetUrl);
    setShowNativeFallback(false);
    console.log("[callback] Forwarding to native app:", targetUrl);
    window.location.href = targetUrl;
    return window.setTimeout(() => {
      setShowNativeFallback(true);
    }, 1200);
  }

  function safeNavigate(retries = 20, delay = 150) {
    try {
      router.replace(POST_AUTH_ROUTE);
    } catch (e) {
      if (retries > 0) {
        setTimeout(() => safeNavigate(retries - 1, delay), delay);
      } else {
        captureError(e instanceof Error ? e : new Error(String(e)));
        setError("Navigation failed - please refresh the page.");
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

  if (nativeAppUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.message, { color: theme.text }]}>Opening the Phina app...</Text>
        {showNativeFallback ? (
          <>
            <Text style={[styles.secondaryMessage, { color: theme.textSecondary }]}>
              If the app did not open automatically, tap below.
            </Text>
            <Text
              style={[styles.link, { color: theme.primary }]}
              onPress={() => {
                window.location.href = nativeAppUrl;
              }}
            >
              Open app
            </Text>
          </>
        ) : null}
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
  secondaryMessage: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 16,
    maxWidth: 320,
  },
  link: {
    fontSize: 16,
    marginTop: 24,
    textDecorationLine: "underline",
  },
});
