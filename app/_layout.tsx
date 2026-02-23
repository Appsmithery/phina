import { useEffect } from "react";
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
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
  });

  useEffect(() => {
    if (sessionLoaded && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync();
    }
  }, [sessionLoaded, fontsLoaded, fontError]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="join/[eventId]" />
      <Stack.Screen name="event/create" />
      <Stack.Screen name="event/[id]/index" />
      <Stack.Screen name="event/[id]/add-wine" />
      <Stack.Screen name="event/[id]/qr" />
      <Stack.Screen name="event/[id]/wine/[wineId]" />
      <Stack.Screen name="event/[id]/rate/[wineId]" />
    </Stack>
  );
}
