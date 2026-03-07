import { Stack, useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Rating } from "@/types/database";


export default function PersonalWineDetailScreen() {
  const params = useLocalSearchParams<{ wineId: string }>();
  const wineId = typeof params.wineId === "string" ? params.wineId : params.wineId?.[0];
  const theme = useTheme();
  const { session, member } = useSupabase();
  const userId = session?.user?.id ?? member?.id;

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines_with_price_privacy")
        .select("*")
        .eq("id", wineId!)
        .single();
      if (error) throw error;
      return data as WineWithPricePrivacy;
    },
    enabled: !!wineId,
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

  const queryClient = useQueryClient();
  const isOwner = wine && member?.id === wine.brought_by;
  const hasGeneratedImage = wine?.image_generation_status === "generated" && !!wine.display_photo_url;
  const isImagePending = wine?.image_generation_status === "pending" && !wine.display_photo_url;
  const fallbackPhotoUrl =
    !hasGeneratedImage && !isImagePending ? (wine?.display_photo_url ?? wine?.label_photo_url ?? null) : null;

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/cellar");
  };

  const handleDelete = () => {
    if (!wine?.id) return;
    showAlert(
      "Delete from cellar",
      "Permanently delete this wine from your cellar?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("wines").delete().eq("id", wine.id);
            if (error) {
              showAlert("Error", error.message ?? "Could not delete wine.");
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
            router.back();
          },
        },
      ]
    );
  };

  const handleToggleConsumed = async () => {
    if (!wine?.id) return;
    const isConsumed = wine.status === "consumed";
    const { error } = await supabase
      .from("wines")
      .update({
        status: isConsumed ? "storage" : "consumed",
        date_consumed: isConsumed ? null : new Date().toISOString().split("T")[0],
      })
      .eq("id", wine.id);
    if (error) {
      showAlert("Error", error.message ?? "Could not update wine.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
    queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity onPress={handleBackPress} style={styles.headerBackButton} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      {isImagePending ? (
        <View style={[styles.heroContainer, styles.pendingHero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="image-outline" size={34} color={theme.primary} style={styles.pendingIcon} />
          <Text style={[styles.pendingHeroTitle, { color: theme.text }]}>Image generation in progress</Text>
          <Text style={[styles.pendingHeroBody, { color: theme.textSecondary }]}>
            Your enhanced bottle photo will appear here shortly.
          </Text>
        </View>
      ) : hasGeneratedImage ? (
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: wine.display_photo_url ?? "" }}
            style={styles.photo}
            resizeMode="cover"
          />
          <View style={[styles.enhancedBadge, { backgroundColor: theme.primary + "20" }]}>
            <Text style={[styles.enhancedBadgeText, { color: theme.primary }]}>Enhanced from scan</Text>
          </View>
        </View>
      ) : fallbackPhotoUrl ? (
        <View style={[styles.heroContainer, { backgroundColor: theme.surface }]}>
          <Image
            source={{ uri: fallbackPhotoUrl }}
            style={styles.photo}
            resizeMode="contain"
          />
        </View>
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
      {wine.quantity != null && wine.quantity >= 1 && (
        <Text style={[styles.quantityText, { color: theme.textSecondary }]}>Quantity: {wine.quantity}</Text>
      )}
      {(wine.price_cents != null || wine.price_range != null) && (
        <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
          Price: {wine.price_cents != null ? `$${wine.price_cents / 100}` : wine.price_range ?? ""}
        </Text>
      )}
      {wine.wine_attributes && (wine.wine_attributes.body_inferred || wine.wine_attributes.acidity_inferred) && (
        <View style={[styles.characteristicsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.characteristicsTitle, { color: theme.textSecondary }]}>CHARACTERISTICS</Text>
          {wine.wine_attributes.body_inferred && (
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
                        left: `${wine.wine_attributes.body_inferred === "light" ? 0 : wine.wine_attributes.body_inferred === "medium" ? 50 : 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Full</Text>
              </View>
            </View>
          )}
          {wine.wine_attributes.acidity_inferred && (
            <View style={styles.ratingScaleContainer}>
              <Text style={[styles.ratingScaleLabel, { color: theme.textSecondary }]}>Dryness</Text>
              <View style={styles.ratingScaleTrackRow}>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Sweet</Text>
                <View style={styles.ratingScaleTrackWrapper}>
                  <View style={[styles.ratingScaleTrack, { backgroundColor: theme.border }]} />
                  <View
                    style={[
                      styles.ratingScaleMarker,
                      {
                        backgroundColor: theme.primary,
                        left: `${wine.wine_attributes.acidity_inferred === "low" ? 0 : wine.wine_attributes.acidity_inferred === "medium" ? 50 : 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.ratingScaleExtreme, { color: theme.textMuted }]}>Bone Dry</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {(wine.drink_from != null || wine.drink_until != null) && (
        <View style={[styles.drinkingWindow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.drinkingWindowLabel, { color: theme.textSecondary }]}>Drinking window</Text>
          <Text style={[styles.drinkingWindowValue, { color: wine.drink_until != null && wine.drink_until < new Date().getFullYear() ? "#B55A5A" : theme.text }]}>
            {wine.drink_from != null && wine.drink_until != null
              ? `${wine.drink_from}–${wine.drink_until}`
              : wine.drink_from != null
              ? `From ${wine.drink_from}`
              : `Until ${wine.drink_until}`}
            {wine.drink_until != null && wine.drink_until < new Date().getFullYear() ? "  (past window)" : ""}
          </Text>
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
        </View>
      )}
      {!ratingPending && rating == null && userId && (
        <Text style={[styles.noRating, { color: theme.textMuted }]}>You haven't rated this wine.</Text>
      )}

      {userId && (
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: theme.primary }]}
          onPress={() => wineId && router.push(`/wine/${wineId}/rate`)}
        >
          <Text style={styles.rateButtonText}>Rate this wine</Text>
        </TouchableOpacity>
      )}

      {(wine.ai_geography || wine.ai_production || wine.ai_tasting_notes || wine.ai_pairings) ? (
        <>
          {wine.ai_geography && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="location-outline" size={18} color={theme.primary} style={styles.sectionIcon} />
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Geography</Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_geography}</Text>
            </>
          )}
          {wine.ai_production && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flask-outline" size={18} color={theme.primary} style={styles.sectionIcon} />
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Production</Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_production}</Text>
            </>
          )}
          {wine.ai_tasting_notes && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="wine-outline" size={18} color={theme.primary} style={styles.sectionIcon} />
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Tasting Notes</Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.text }]}>{wine.ai_tasting_notes}</Text>
            </>
          )}
          {wine.ai_pairings && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="restaurant-outline" size={18} color={theme.primary} style={styles.sectionIcon} />
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Suggested Pairings</Text>
              </View>
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

      {isOwner && (
        <>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push(`/wine/${wine.id}/edit`)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanButton, { borderColor: theme.border }]}
            onPress={() =>
              router.push({
                pathname: "/scan-label",
                params: {
                  returnTo: `/wine/${wine.id}`,
                  scanMode: "apply_existing_wine",
                  wineId: wine.id,
                },
              })
            }
          >
            <Text style={[styles.scanButtonText, { color: theme.textSecondary }]}>Update label (scan)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.consumedButton, { borderColor: theme.primary }]}
            onPress={handleToggleConsumed}
          >
            <Text style={[styles.consumedButtonText, { color: theme.primary }]}>
              {wine.status === "consumed" ? "Move back to storage" : "Mark as consumed"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: "#B55A5A" }]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete from cellar</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  headerBackButton: { paddingHorizontal: 8, paddingVertical: 4 },
  heroContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    marginBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingHero: {
    borderWidth: 1,
    paddingHorizontal: 28,
  },
  pendingIcon: { marginBottom: 14 },
  pendingHeroTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_600SemiBold",
    textAlign: "center",
    marginBottom: 8,
  },
  pendingHeroBody: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  photo: { width: "100%", height: "100%" },
  enhancedBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  enhancedBadgeText: { fontSize: 10, fontFamily: "Montserrat_600SemiBold" },
  characteristicsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  characteristicsTitle: {
    fontSize: 11,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 4 },
  sectionIcon: { marginRight: 6 },
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
  sectionHeader: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 16 },
  sectionBody: { fontFamily: "Montserrat_400Regular", fontSize: 15, lineHeight: 22 },
  editButton: { borderRadius: 12, padding: 12, alignItems: "center", marginTop: 24 },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  scanButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  scanButtonText: { fontSize: 16, fontWeight: "500", fontFamily: "Montserrat_400Regular" },
  placeholder: { padding: 24, fontFamily: "Montserrat_400Regular" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  drinkingWindow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  drinkingWindowLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold", marginBottom: 4 },
  drinkingWindowValue: { fontSize: 15, fontFamily: "Montserrat_400Regular" },
  consumedButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  consumedButtonText: { fontSize: 16, fontWeight: "500", fontFamily: "Montserrat_400Regular" },
  deleteButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  deleteButtonText: { color: "#B55A5A", fontSize: 16, fontWeight: "500", fontFamily: "Montserrat_400Regular" },
});
