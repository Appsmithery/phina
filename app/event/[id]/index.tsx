import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useStartRatingRound, useEndRatingRound, useEndEvent } from "@/hooks/use-event-actions";
import type { Event } from "@/types/database";
import type { Wine } from "@/types/database";
import type { RatingRound } from "@/types/database";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useSupabase();
  const theme = useTheme();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
  });

  const { data: wines = [] } = useQuery({
    queryKey: ["wines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("event_id", id!).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Wine[];
    },
    enabled: !!id,
  });

  const { data: rounds = [] } = useQuery({
    queryKey: ["rating_rounds", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rating_rounds").select("*").eq("event_id", id!);
      if (error) throw error;
      return data as RatingRound[];
    },
    enabled: !!id && !!event,
  });

  const { data: ratingSummaries = [] } = useQuery({
    queryKey: ["event_rating_summary", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_wine_ratings", { p_event_id: id! });
      if (error) throw error;
      return (data ?? []) as { wine_id: string; thumbs_up: number; meh: number; thumbs_down: number }[];
    },
    enabled: !!id && event?.status === "ended",
  });

  const isHost = event?.created_by === member?.id;
  const endEventMutation = useEndEvent(id!);

  if (!id || isLoading || !event) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {event.theme} · {new Date(event.date).toLocaleDateString()} · {event.status}
      </Text>

      {isHost && (
        <>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push(`/event/${id}/qr`)}
          >
            <Text style={styles.primaryButtonText}>Show QR code</Text>
          </TouchableOpacity>
          {event.status === "active" && (
            <TouchableOpacity
              style={[styles.endEventButton, { borderColor: theme.textMuted }]}
              onPress={() =>
                Alert.alert("End event?", "Results will be revealed to everyone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "End event", style: "destructive", onPress: () => endEventMutation.mutate() },
                ])
              }
              disabled={endEventMutation.isPending}
            >
              <Text style={[styles.endEventText, { color: theme.textMuted }]}>End event</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <TouchableOpacity
          style={[styles.addWineButton, { borderColor: theme.primary }]}
          onPress={() => router.push(`/event/${id}/add-wine`)}
        >
          <Text style={[styles.addWineText, { color: theme.primary }]}>+ Add wine</Text>
        </TouchableOpacity>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Wines</Text>
      {wines.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>No wines yet.</Text>
      ) : (
        <FlatList
          data={wines}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const round = rounds.find((r) => r.wine_id === item.id);
            const summary = ratingSummaries.find((s) => s.wine_id === item.id);
            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.push(`/event/${id}/wine/${item.id}`)}>
                  <Text style={[styles.wineName, { color: theme.text }]}>
                    {item.quantity != null && item.quantity > 1 ? `${item.quantity}× ` : ""}
                    {item.producer ?? "Unknown"} {item.varietal ?? ""} {item.vintage ?? ""}
                  </Text>
                  {item.region && (
                    <Text style={[styles.wineMeta, { color: theme.textSecondary }]}>{item.region}</Text>
                  )}
                </TouchableOpacity>
                {event.status === "ended" && summary && (
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultText, { color: theme.text }]}>
                      👍 {summary.thumbs_up}  😐 {summary.meh}  👎 {summary.thumbs_down}
                    </Text>
                  </View>
                )}
                {event.status === "active" && isHost && (
                  <WineHostActions
                    eventId={id!}
                    wine={item}
                    round={round}
                    theme={theme}
                    onRate={() => router.push(`/event/${id}/rate/${item.id}`)}
                  />
                )}
                {event.status === "active" && !isHost && (
                  <TouchableOpacity
                    style={[styles.rateButton, { backgroundColor: theme.secondary }]}
                    onPress={() => router.push(`/event/${id}/rate/${item.id}`)}
                  >
                    <Text style={styles.rateButtonText}>Rate</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 8 },
  back: { fontSize: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  meta: { fontSize: 14, marginBottom: 16 },
  primaryButton: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 24 },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  addWineButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16 },
  addWineText: { fontSize: 16, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  wineName: { fontSize: 16, fontWeight: "600" },
  wineMeta: { fontSize: 14, marginTop: 4 },
  placeholder: { padding: 16 },
  endEventButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16 },
  endEventText: { fontSize: 16 },
  rateButton: { borderRadius: 12, padding: 10, alignItems: "center", marginTop: 12 },
  rateButtonText: { color: "#fff", fontWeight: "600" },
  resultRow: { marginTop: 12 },
  resultText: { fontSize: 15 },
});

function WineHostActions({
  eventId,
  wine,
  round,
  theme: t,
  onRate,
}: {
  eventId: string;
  wine: Wine;
  round: RatingRound | undefined;
  theme: ReturnType<typeof useTheme>;
  onRate: () => void;
}) {
  const startRound = useStartRatingRound(eventId, wine.id);
  const endRound = useEndRatingRound(round?.id ?? "", eventId, wine.id);

  if (round?.is_active) {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: t.secondary }]}
          onPress={onRate}
        >
          <Text style={styles.rateButtonText}>Rate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: t.textMuted }]}
          onPress={() => endRound.mutate()}
          disabled={endRound.isPending}
        >
          <Text style={styles.rateButtonText}>End round</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.rateButton, { backgroundColor: t.primary, marginTop: 12 }]}
      onPress={() => startRound.mutate()}
      disabled={startRound.isPending}
    >
      <Text style={styles.rateButtonText}>{startRound.isPending ? "Starting…" : "Start rating round"}</Text>
    </TouchableOpacity>
  );
}
