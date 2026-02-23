import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider, useSupabase } from "@/lib/supabase-context";
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const SPLASH_TIMEOUT_MS = 4000;

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>{this.state.message}</Text>
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
});

export default function RootLayout() {
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
  const { sessionLoaded } = useSupabase();
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
  });

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="join/[eventId]" />
      <Stack.Screen name="event/create" />
      <Stack.Screen name="event/[id]/index" />
      <Stack.Screen name="event/[id]/add-wine" />
      <Stack.Screen name="event/[id]/scan-label" />
      <Stack.Screen name="event/[id]/qr" />
      <Stack.Screen name="event/[id]/wine/[wineId]" />
      <Stack.Screen name="event/[id]/rate/[wineId]" />
    </Stack>
  );
}
