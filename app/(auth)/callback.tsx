import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { createSessionFromUrl } from "@/lib/oauth-google";

/**
 * OAuth callback route for web.
 * Handles the redirect from Google OAuth with code or tokens in the URL.
 * Exchanges the code for a session and redirects to the app.
 */
export default function CallbackScreen() {
  const theme = useTheme();
  const { setSessionFromAuth } = useSupabase();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full URL with hash/query params
        const url = typeof window !== "undefined" ? window.location.href : "";
        
        if (!url) {
          setError("No URL found");
          return;
        }

        // Create session from URL (handles both code and token flows)
        const session = await createSessionFromUrl(url);

        if (session) {
          setSessionFromAuth(session);
          // Small delay to let context update
          setTimeout(() => {
            router.replace("/(tabs)");
          }, 100);
        } else {
          setError("Failed to create session from callback");
        }
      } catch (err) {
        console.error("[callback] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    handleCallback();
  }, [setSessionFromAuth]);

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
