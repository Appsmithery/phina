import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";

export default function Index() {
  const { session, sessionLoaded } = useSupabase();

  if (!sessionLoaded) {
    return null;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)" />;
}
