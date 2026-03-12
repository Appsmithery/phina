import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { WineHeroImage } from "@/components/WineHeroImage";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Event } from "@/types/database";
import type { Rating } from "@/types/database";
import type { RatingRound } from "@/types/database";


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

  const { data: voteSummaries } = useQuery({
    queryKey: ["eventWineRatings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_wine_ratings", { p_event_id: eventId! });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId && event?.status === "ended",
  });
  const voteSummary = voteSummaries?.find((s) => s.wine_id === wineId);

  const { data: tagRows } = useQuery({
    queryKey: ["eventWineTagSummary", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_wine_tag_summary", { p_event_id: eventId! });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId && event?.status === "ended",
  });
  const wineTags = tagRows?.filter((r) => r.wine_id === wineId) ?? [];

  // Fetch all event wines to determine wine index for double blind
  const { data: eventWines = [] } = useQuery({
    queryKey: ["wines", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines_with_price_privacy").select("*").eq("event_id", eventId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data as WineWithPricePrivacy[];
    },
    enabled: !!eventId,
  });

  const isHost = event?.created_by === member?.id;
  const isDoubleBlind = event?.tasting_mode === "double_blind" && event?.status === "active";
  const hideDetails = isDoubleBlind && !isHost;
  const wineIndex = eventWines.findIndex((w) => w.id === wineId);
  const blindLabel = wineIndex >= 0 ? `Wine #${wineIndex + 1}` : "Wine";

  const canEdit = Boolean(
    wine &&
      eventId &&
      (member?.id === wine.brought_by || event?.created_by === member?.id)
  );
  const canRemove = Boolean(wine && eventId && event?.created_by === member?.id);

  const handleRemove = () => {
    if (!wine?.id || !eventId) return;
    showAlert(
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
              showAlert("Error", error.message ?? "Could not remove wine.");
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
      {hideDetails ? (
        <>
          <Text style={[styles.producer, { color: theme.text }]}>{blindLabel}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>Details hidden until the event ends</Text>
        </>
      ) : (
        <>
          <WineHeroImage
            displayPhotoUrl={wine.display_photo_url}
            labelPhotoUrl={wine.label_photo_url}
            imageGenerationStatus={wine.image_generation_status}
            backgroundColor={theme.surface}
            borderColor={theme.border}
            accentColor={theme.primary}
            textColor={theme.text}
            textSecondaryColor={theme.textSecondary}
          />
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
        </>
      )}

      {event?.status === "ended" && voteSummary && (
        <View style={[styles.ratingBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.ratingBlockTitle, { color: theme.text, marginBottom: 8 }]}>Event results</Text>
          <Text style={[styles.voteRow, { color: theme.text }]}>
            👍 {voteSummary.thumbs_up}{"  "}😐 {voteSummary.meh}{"  "}👎 {voteSummary.thumbs_down}
          </Text>
          {wineTags.length > 0 && (
            <>
              <Text style={[styles.ratingScaleLabel, { color: theme.textSecondary, marginTop: 10, marginBottom: 6 }]}>
                Tasting notes from attendees
              </Text>
              <View style={styles.tagRow}>
                {wineTags.map((t) => (
                  <View key={t.tag} style={[styles.tagBadge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
                    <Text style={[styles.tagBadgeText, { color: theme.primary }]}>
                      {t.tag.charAt(0).toUpperCase() + t.tag.slice(1)} ×{t.tag_count}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {rating != null && (
        <View style={[styles.ratingBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.ratingHeaderRow}>
            <Text style={[styles.ratingBlockTitle, { color: theme.text }]}>Your rating</Text>
            {rating.value === -1 ? (
              <Ionicons name="thumbs-down" size={22} color={theme.thumbsDown} />
            ) : rating.value === 0 ? (
              <MaterialCommunityIcons name="scale-balance" size={22} color={theme.meh} />
            ) : (
              <Ionicons name="thumbs-up" size={22} color={theme.thumbsUp} />
            )}
          </View>
          {rating.body && (
            <View style={styles.ratingScaleContainer}>
              <Text style={[styles.ratingScaleLabel, { color: theme.textSecondary }]}>Body</Text>
              <View style={styles.ratingScaleTrackRow}>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Light</Text>
                <View style={styles.ratingScaleTrackWrapper}>
                  <View style={[styles.ratingScaleTrack, { backgroundColor: theme.border }]} />
                  <View
                    style={[
                      styles.ratingScaleMarker,
                      {
                        backgroundColor: theme.primary,
                        left: `${rating.body === "light" ? 0 : rating.body === "medium" ? 50 : 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Full</Text>
              </View>
            </View>
          )}
          {rating.sweetness && (
            <View style={styles.ratingScaleContainer}>
              <Text style={[styles.ratingScaleLabel, { color: theme.textSecondary }]}>Dryness</Text>
              <View style={styles.ratingScaleTrackRow}>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Dry</Text>
                <View style={styles.ratingScaleTrackWrapper}>
                  <View style={[styles.ratingScaleTrack, { backgroundColor: theme.border }]} />
                  <View
                    style={[
                      styles.ratingScaleMarker,
                      {
                        backgroundColor: theme.primary,
                        left: `${rating.sweetness === "dry" ? 0 : rating.sweetness === "off-dry" ? 50 : 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Sweet</Text>
              </View>
            </View>
          )}
          {rating.confidence != null && (
            <Text style={[styles.ratingMeta, { color: theme.textSecondary }]}>
              Confidence: {Math.round(rating.confidence * 100)}%
            </Text>
          )}
          {rating.tags != null && rating.tags.length > 0 && (
            <View style={[styles.tagRow, { marginTop: 8 }]}>
              {rating.tags.map((tag) => (
                <View key={tag} style={[styles.tagBadge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
                  <Text style={[styles.tagBadgeText, { color: theme.primary }]}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {rating.note ? (
            <Text style={[styles.ratingMeta, { color: theme.textSecondary, marginTop: 6 }]}>"{rating.note}"</Text>
          ) : null}
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

      {!hideDetails && (wine.ai_geography || wine.ai_production || wine.ai_tasting_notes || wine.ai_pairings) ? (
        <>
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
      ) : !hideDetails && wine.ai_summary ? (
        <>
          <Text style={[styles.sectionHeader, { color: theme.text }]}>About</Text>
          <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_summary}</Text>
        </>
      ) : null}
      {canEdit || canRemove ? (
        <>
          {canEdit ? (
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push(`/wine/${wine.id}/edit`)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {canRemove ? (
            <TouchableOpacity
              style={[styles.removeButton, { borderColor: theme.textMuted }]}
              onPress={handleRemove}
            >
              <Text style={[styles.removeButtonText, { color: theme.textMuted }]}>Remove from event</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  producer: { fontSize: 22, fontWeight: "700", marginBottom: 4, fontFamily: "PlayfairDisplay_700Bold" },
  meta: { fontSize: 16, marginBottom: 8, fontFamily: "Montserrat_400Regular" },
  quantityText: { fontSize: 14, marginBottom: 16, fontFamily: "Montserrat_400Regular" },
  ratingBlock: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  ratingHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  ratingBlockTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  ratingScaleContainer: { marginBottom: 12 },
  ratingScaleLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, marginBottom: 6 },
  ratingScaleTrackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingScaleExtreme: { fontFamily: "Montserrat_400Regular", fontSize: 11, width: 36 },
  ratingScaleTrackWrapper: { flex: 1, height: 4, position: "relative" },
  ratingScaleTrack: { width: "100%", height: 4, borderRadius: 2 },
  ratingScaleMarker: { position: "absolute", width: 14, height: 14, borderRadius: 7, top: -5, marginLeft: -7 },
  ratingMeta: { fontSize: 13, marginBottom: 2, fontFamily: "Montserrat_400Regular" },
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
  voteRow: { fontSize: 18, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagBadge: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  tagBadgeText: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
});
