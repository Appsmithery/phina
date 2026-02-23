import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Wine } from "@/types/database";
import type { RatingRound } from "@/types/database";

type Vote = -1 | 0 | 1;

export default function RateWineScreen() {
  const { wineId } = useLocalSearchParams<{ id: string; wineId: string }>();
  const { member } = useSupabase();
  const theme = useTheme();
  const [, setVote] = useState<Vote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: wine } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as Wine;
    },
    enabled: !!wineId,
  });

  const { data: round } = useQuery({
    queryKey: ["ratingRound", wineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rating_rounds")
        .select("*")
        .eq("wine_id", wineId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as RatingRound | null;
    },
    enabled: !!wineId,
  });

  const submit = async (value: Vote) => {
    if (!member?.id || !wineId || !round) return;
    setVote(value);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await supabase.from("ratings").upsert(
        { wine_id: wineId, member_id: member.id, value },
        { onConflict: "wine_id,member_id" }
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ratingRound", wineId] });
      Alert.alert("Vote recorded!", "Thanks for rating.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (!wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  const canVote = round?.is_active && !submitting;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {wine.producer ?? "Unknown"} {wine.varietal ?? ""} {wine.vintage ?? ""}
      </Text>
      {!round ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>No active rating round. Wait for the host to start one.</Text>
      ) : round.ended_at ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>This round has ended.</Text>
      ) : (
        <>
          <Text style={[styles.prompt, { color: theme.text }]}>Your rating:</Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.voteBtn, { backgroundColor: theme.thumbsDown }]}
              onPress={() => canVote && submit(-1)}
              disabled={!canVote}
            >
              <Text style={styles.voteEmoji}>👎</Text>
              <Text style={styles.voteLabel}>Down</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteBtn, { backgroundColor: theme.meh }]}
              onPress={() => canVote && submit(0)}
              disabled={!canVote}
            >
              <Text style={styles.voteEmoji}>😐</Text>
              <Text style={styles.voteLabel}>Meh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteBtn, { backgroundColor: theme.thumbsUp }]}
              onPress={() => canVote && submit(1)}
              disabled={!canVote}
            >
              <Text style={styles.voteEmoji}>👍</Text>
              <Text style={styles.voteLabel}>Up</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  prompt: { fontSize: 16, textAlign: "center", marginBottom: 16 },
  buttons: { flexDirection: "row", justifyContent: "space-evenly", gap: 16 },
  voteBtn: { flex: 1, borderRadius: 14, padding: 20, alignItems: "center" },
  voteEmoji: { fontSize: 32, marginBottom: 8 },
  voteLabel: { color: "#fff", fontWeight: "600" },
  hint: { textAlign: "center", fontSize: 16 },
  placeholder: { textAlign: "center" },
});
