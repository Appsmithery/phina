import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSupabase } from "@/lib/supabase-context";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";

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
      router.replace({ pathname: "/(auth)", params: { redirect: `join/${eventId}` } });
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
        setDone(true);
        router.replace(`/event/${eventId}`);
      } catch {
        setJoining(false);
      }
    })();
  }, [sessionLoaded, session, eventId]);

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
  text: { marginTop: 16, fontSize: 16 },
});
