import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, Linking, TouchableOpacity } from "react-native";
import { Stack, router } from "expo-router";
import { initObservability, captureError, Sentry } from "@/lib/observability";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider, useSupabase } from "@/lib/supabase-context";
import { createSessionFromUrl } from "@/lib/oauth-google";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from "@expo-google-fonts/playfair-display";
import {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";

try {
  initObservability();
} catch (e) {
  console.warn("Observability init failed", e);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

const SPLASH_TIMEOUT_MS = 4000;

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>{this.state.message}</Text>
          <TouchableOpacity style={errorStyles.button} onPress={() => router.replace("/")}>
            <Text style={errorStyles.buttonText}>Try again</Text>
          </TouchableOpacity>
          <Text style={errorStyles.errorId}>Error ID: {Sentry.lastEventId()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  message: { fontSize: 14, color: "#666", textAlign: "center" },
  button: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: "#B58271", borderRadius: 8 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  errorId: { marginTop: 12, fontSize: 11, color: "#aaa" },
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <SupabaseProvider>
          <SupabaseLayout />
        </SupabaseProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

function SupabaseLayout() {
  const { sessionLoaded, setSessionFromAuth } = useSupabase();
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
  });

  // Deep link: when user taps a push notification, open the URL in data.url (e.g. /event/:id/rate/:wineId)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as `/${string}`);
      }
    });
    return () => sub.remove();
  }, []);

  // Deep link: OAuth callback (phina:// for native builds, exp:// for Expo Go)
  useEffect(() => {
    if (Platform.OS === "web") return; // Web uses callback route instead

    let processedUrl: string | null = null;

    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (__DEV__) {
        console.log("[deep-link] Received URL", { url });
      }

      if (!url || url === processedUrl) return;

      // Only handle URLs that look like OAuth callbacks (contain auth params)
      const isOAuthCallback =
        url.includes("access_token") ||
        url.includes("refresh_token") ||
        url.includes("code=");

      if (__DEV__) {
        console.log("[deep-link] OAuth callback check", { isOAuthCallback });
      }

      if (isOAuthCallback) {
        console.log("[deep-link] ✅ Detected OAuth callback, creating session from URL");
        processedUrl = url;
        const session = await createSessionFromUrl(url);
        if (session) {
          console.log("[deep-link] ✅ Session created, navigating to root guard");
          setSessionFromAuth(session);
          router.replace("/");
        } else {
          console.error("[deep-link] ❌ createSessionFromUrl returned null");
        }
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (__DEV__) {
        console.log("[deep-link] Initial URL", { url });
      }
      if (url) handleUrl({ url });
    });

    // Handle URL while app is running
    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, [setSessionFromAuth]);

  // On web, fix malformed path (e.g. // from magic link redirect) so router and Supabase can handle /
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "//" || path.startsWith("//")) {
      const hash = window.location.hash || "";
      window.history.replaceState(null, "", `/${hash}`);
      router.replace("/");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSplashTimedOut(true), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ready = sessionLoaded && (fontsLoaded || fontError);
    if (ready || splashTimedOut) {
      SplashScreen.hideAsync();
    }
  }, [sessionLoaded, fontsLoaded, fontError, splashTimedOut]);

  // Blank headers matching page body so content isn't cut off; indistinguishable from body.
  const headerOptions = {
    headerShown: true,
    headerTitle: "",
    headerStyle: { backgroundColor: "#F2EFE9" },
    headerShadowVisible: false,
    headerTintColor: "#B58271",
    headerBackTitleVisible: false,
  };

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="join/[eventId]" />
      <Stack.Screen name="event/create" options={{ title: "Host an Event" }} />
      <Stack.Screen name="event/[id]/index" options={{ title: "Event" }} />
      <Stack.Screen name="event/[id]/add-wine" options={{ title: "Add Wine" }} />
      <Stack.Screen name="event/[id]/qr" />
      <Stack.Screen name="event/[id]/wine/[wineId]" options={{ title: "Wine" }} />
      <Stack.Screen name="event/[id]/rate/[wineId]" options={{ title: "Rate Wine" }} />
      <Stack.Screen name="add-wine" options={{ title: "Add to Cellar" }} />
      <Stack.Screen name="scan-label" />
      <Stack.Screen name="wine/[wineId]/index" options={{ title: "Wine" }} />
      <Stack.Screen name="wine/[wineId]/edit" options={{ title: "Edit Wine" }} />
      <Stack.Screen name="wine/[wineId]/rate" options={{ title: "Rate Wine" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="terms" options={{ title: "Terms of Service" }} />
    </Stack>
  );
}

export default Sentry.wrap(RootLayout);
