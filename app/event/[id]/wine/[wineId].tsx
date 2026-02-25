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
  const { session, member } = useSupabase();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? member?.id;

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
    queryKey: ["rating", wineId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("wine_id", wineId!)
        .eq("member_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Rating | null;
    },
    enabled: !!wineId && !!userId,
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
      {(wine.color || wine.is_sparkling) && (
        <View style={styles.badgeRow}>
          {wine.color && (
            <View style={[styles.badge, { backgroundColor: wine.color === "red" ? "#B55A5A20" : wine.color === "white" ? "#F2EFE920" : "#D9BBAE20", borderColor: wine.color === "red" ? "#B55A5A" : wine.color === "white" ? "#9A8B82" : "#D9BBAE" }]}>
              <Text style={[styles.badgeText, { color: wine.color === "red" ? "#B55A5A" : wine.color === "white" ? "#6B5B54" : "#B58271" }]}>
                {wine.color === "red" ? "Red" : wine.color === "white" ? "White" : "Rose / Orange"}
              </Text>
            </View>
          )}
          {wine.is_sparkling && (
            <View style={[styles.badge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>Sparkling</Text>
            </View>
          )}
        </View>
      )}
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
      {!ratingPending && rating == null && userId && (
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

      {(wine.ai_overview || wine.ai_geography || wine.ai_production || wine.ai_tasting_notes || wine.ai_pairings) ? (
        <>
          {wine.ai_overview && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Overview</Text>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_overview}</Text>
            </>
          )}
          {wine.ai_geography && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Geography</Text>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_geography}</Text>
            </>
          )}
          {wine.ai_production && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Production</Text>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_production}</Text>
            </>
          )}
          {wine.ai_tasting_notes && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Tasting Notes</Text>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_tasting_notes}</Text>
            </>
          )}
          {wine.ai_pairings && (
            <>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Suggested Pairings</Text>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_pairings}</Text>
            </>
          )}
        </>
      ) : wine.ai_summary ? (
        <>
          <Text style={[styles.sectionHeader, { color: theme.text }]}>About</Text>
          <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_summary}</Text>
        </>
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
  producer: { fontSize: 22, fontWeight: "700", marginBottom: 4, fontFamily: "PlayfairDisplay_700Bold" },
  meta: { fontSize: 16, marginBottom: 8, fontFamily: "Montserrat_400Regular" },
  quantityText: { fontSize: 14, marginBottom: 16, fontFamily: "Montserrat_400Regular" },
  ratingBlock: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  ratingBlockTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8, fontFamily: "Montserrat_600SemiBold" },
  ratingVote: { fontSize: 16, marginBottom: 4, fontFamily: "Montserrat_400Regular" },
  ratingMeta: { fontSize: 14, marginBottom: 2, fontFamily: "Montserrat_400Regular" },
  noRating: { fontSize: 14, marginBottom: 12, fontFamily: "Montserrat_400Regular" },
  rateButton: { borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 16 },
  rateButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  summary: { fontSize: 15, lineHeight: 22 },
  sectionHeader: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 16, marginTop: 16, marginBottom: 4 },
  sectionBody: { fontFamily: "Montserrat_400Regular", fontSize: 15, lineHeight: 22 },
  editButton: { borderRadius: 12, padding: 12, alignItems: "center", marginTop: 24 },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  removeButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  removeButtonText: { fontSize: 16, fontWeight: "500", fontFamily: "Montserrat_400Regular" },
  placeholder: { padding: 24, fontFamily: "Montserrat_400Regular" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
