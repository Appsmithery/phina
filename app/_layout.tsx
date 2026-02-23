import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider, useSupabase } from "@/lib/supabase-context";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <SupabaseLayout />
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

function SupabaseLayout() {
  const { sessionLoaded } = useSupabase();

  useEffect(() => {
    if (sessionLoaded) {
      SplashScreen.hideAsync();
    }
  }, [sessionLoaded]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="join/[eventId]" options={{ presentation: "modal" }} />
      <Stack.Screen name="event/[id]/index" />
      <Stack.Screen name="event/[id]/qr" />
      <Stack.Screen name="event/[id]/wine/[wineId]" />
      <Stack.Screen name="event/[id]/rate/[wineId]" />
    </Stack>
  );
}
