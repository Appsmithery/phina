import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Event } from "@/types/database";
import type { Rating } from "@/types/database";
import type { RatingRound } from "@/types/database";

const BODY_LABELS: Record<string, string> = { light: "Light", medium: "Medium", full: "Full" };
const SWEETNESS_LABELS: Record<string, string> = { dry: "Dry", "off-dry": "Off-dry", sweet: "Sweet" };

export default function WineDetailScreen() {
  const params = useLocalSearchParams<{ id: string; wineId: string }>();
  const eventId = typeof params.id === "string" ? params.id : params.id?.[0];
  const wineId = typeof params.wineId === "string" ? params.wineId : params.wineId?.[0];
  const theme = useTheme();
  const { member } = useSupabase();
  const queryClient = useQueryClient();

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines_with_price_privacy").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as WineWithPricePrivacy;
    },
    enabled: !!wineId,
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId && !!wine?.event_id,
  });

  const { data: rating, isPending: ratingPending } = useQuery({
    queryKey: ["rating", wineId, member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("wine_id", wineId!)
        .eq("member_id", member!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Rating | null;
    },
    enabled: !!wineId && !!member?.id,
  });

  const { data: activeRound } = useQuery({
    queryKey: ["ratingRound", eventId, wineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rating_rounds")
        .select("*")
        .eq("event_id", eventId!)
        .eq("wine_id", wineId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as RatingRound | null;
    },
    enabled: !!eventId && !!wineId,
  });

  const canRemove = Boolean(
    wine &&
      eventId &&
      (member?.id === wine.brought_by || event?.created_by === member?.id)
  );

  const handleRemove = () => {
    if (!wine?.id || !eventId) return;
    Alert.alert(
      "Remove from event",
      "Remove this wine from the event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("wines").delete().eq("id", wine.id);
            if (error) {
              Alert.alert("Error", error.message ?? "Could not remove wine.");
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["wines", eventId] });
            queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
            router.back();
          },
        },
      ]
    );
  };

  if (!wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {isLoading ? "Loading…" : "Wine not found."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      {wine.label_photo_url ? (
        <Image
          source={{ uri: wine.label_photo_url }}
          style={styles.photo}
          resizeMode="contain"
        />
      ) : null}
      <Text style={[styles.producer, { color: theme.text }]}>{wine.producer ?? "Unknown producer"}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {[wine.varietal, wine.vintage?.toString(), wine.region].filter(Boolean).join(" · ")}
      </Text>
      {(wine.quantity != null && wine.quantity >= 1) && (
        <Text style={[styles.quantityText, { color: theme.textSecondary }]}>Quantity: {wine.quantity}</Text>
      )}
      {(wine.price_cents != null || wine.price_range != null) && (
        <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
          Price: {wine.price_cents != null ? `$${wine.price_cents / 100}` : wine.price_range ?? ""}
        </Text>
      )}

      {rating != null && (
        <View style={[styles.ratingBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.ratingBlockTitle, { color: theme.text }]}>Your rating</Text>
          <Text style={[styles.ratingVote, { color: theme.text }]}>
            {rating.value === -1 ? "👎 Down" : rating.value === 0 ? "😐 Meh" : "👍 Up"}
          </Text>
          {rating.body && (
            <Text style={[styles.ratingMeta, { color: theme.textSecondary }]}>
              Body: {BODY_LABELS[rating.body] ?? rating.body}
            </Text>
          )}
          {rating.sweetness && (
            <Text style={[styles.ratingMeta, { color: theme.textSecondary }]}>
              Dryness: {SWEETNESS_LABELS[rating.sweetness] ?? rating.sweetness}
            </Text>
          )}
          {rating.confidence != null && (
            <Text style={[styles.ratingMeta, { color: theme.textSecondary }]}>
              Confidence: {Math.round(rating.confidence * 100)}%
            </Text>
          )}
        </View>
      )}
      {!ratingPending && rating == null && member?.id && (
        <Text style={[styles.noRating, { color: theme.textMuted }]}>You haven't rated this wine.</Text>
      )}

      {activeRound && eventId && wineId && (
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push(`/event/${eventId}/rate/${wineId}`)}
        >
          <Text style={styles.rateButtonText}>Rate this wine</Text>
        </TouchableOpacity>
      )}

      {wine.ai_summary ? (
        <Text style={[styles.summary, { color: theme.text }]}>{wine.ai_summary}</Text>
      ) : null}
      {canRemove && (
        <>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push(`/wine/${wine.id}/edit`)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.removeButton, { borderColor: theme.textMuted }]}
            onPress={handleRemove}
          >
            <Text style={[styles.removeButtonText, { color: theme.textMuted }]}>Remove from event</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  photo: { width: "100%", height: 200, borderRadius: 14, marginBottom: 16 },
  producer: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  meta: { fontSize: 16, marginBottom: 8 },
  quantityText: { fontSize: 14, marginBottom: 16 },
  ratingBlock: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  ratingBlockTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  ratingVote: { fontSize: 16, marginBottom: 4 },
  ratingMeta: { fontSize: 14, marginBottom: 2 },
  noRating: { fontSize: 14, marginBottom: 12 },
  rateButton: { borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 16 },
  rateButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  summary: { fontSize: 15, lineHeight: 22 },
  editButton: { borderRadius: 12, padding: 12, alignItems: "center", marginTop: 24 },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  removeButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  removeButtonText: { fontSize: 16, fontWeight: "500" },
  placeholder: { padding: 24 },
});
