import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useSupabase } from "@/lib/supabase-context";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";
import { setPendingJoinEventId } from "@/lib/pending-join";
import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";

export default function JoinEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionLoaded || !eventId) return;
    if (!session) {
      setPendingJoinEventId(eventId).then(() => {
        router.replace("/(auth)");
      });
      return;
    }
    (async () => {
      setJoining(true);
      try {
        await supabase.from("event_members").upsert(
          { event_id: eventId, member_id: session.user.id, checked_in: true },
          { onConflict: "event_id,member_id" }
        );
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["event", eventId] });
        queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] });
        setDone(true);
        trackEvent("event_joined", { event_id: eventId, platform: Platform.OS, source: "join_link" });
        router.replace(`/event/${eventId}`);
      } catch (e: unknown) {
        showAlert("Error", e instanceof Error ? e.message : "Could not join event. Please try again.");
        setJoining(false);
      }
    })();
  }, [sessionLoaded, session, eventId, queryClient]);

  if (!sessionLoaded || joining) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.text, { color: theme.textSecondary }]}>Joining event…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>
        {done ? "You're in!" : "Redirecting…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  text: { marginTop: 16, fontSize: 16, fontFamily: "Montserrat_400Regular" },
});
