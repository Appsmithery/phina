import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform } from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { RatingInfoModal, RatingSectionHeader, type RatingInfoKey } from "@/components/rating/RatingInfoModal";
import { RatingVoteSelector } from "@/components/rating/RatingVoteSelector";
import { WineHeroImage } from "@/components/WineHeroImage";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";
import type { Event, WineWithPricePrivacy } from "@/types/database";
import type { RatingRound } from "@/types/database";
import type { Rating } from "@/types/database";

type Vote = -1 | 0 | 1;
type BodyOption = "light" | "medium" | "full";
type SweetnessOption = "dry" | "off-dry" | "sweet";
type RatingTag = "minerality" | "fruit" | "spice" | "tannic" | "oak" | "floral";

const RATING_TAGS: { label: string; value: RatingTag }[] = [
  { label: "Minerality", value: "minerality" },
  { label: "Fruit", value: "fruit" },
  { label: "Spice", value: "spice" },
  { label: "Tannic", value: "tannic" },
  { label: "Oak", value: "oak" },
  { label: "Floral", value: "floral" },
];

const BODY_OPTIONS: { label: string; value: BodyOption }[] = [
  { label: "Light", value: "light" },
  { label: "Medium", value: "medium" },
  { label: "Full", value: "full" },
];
const SWEETNESS_OPTIONS: { label: string; value: SweetnessOption }[] = [
  { label: "Sweet", value: "sweet" },
  { label: "Off-dry", value: "off-dry" },
  { label: "Dry", value: "dry" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  theme,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T | null) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={segStyles.row}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              segStyles.pill,
              { borderColor: theme.border },
              selected && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
            ]}
            onPress={() => onChange(selected ? null : opt.value)}
          >
            <Text
              style={[
                segStyles.pillText,
                { color: theme.textSecondary },
                selected && { color: theme.primary },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: "center",
  },
  pillText: { fontSize: 14, fontFamily: "Montserrat_600SemiBold" },
});

export default function RateWineScreen() {
  const params = useLocalSearchParams<{ id: string; wineId: string | string[] }>();
  const eventId = typeof params.id === "string" ? params.id : params.id?.[0];
  const wineId = typeof params.wineId === "string" ? params.wineId : params.wineId?.[0];
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const [vote, setVote] = useState<Vote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState<BodyOption | null>(null);
  const [sweetness, setSweetness] = useState<SweetnessOption | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);
  const [note, setNote] = useState("");
  const [activeInfoKey, setActiveInfoKey] = useState<RatingInfoKey | null>(null);
  const queryClient = useQueryClient();
  const trackedRatingFlowRef = useRef<string | null>(null);

  const userId = session?.user?.id ?? member?.id;
  const isAuthenticated = sessionLoaded && !!session;

  const { data: wine } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines_with_price_privacy").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as WineWithPricePrivacy;
    },
    enabled: !!wineId && isAuthenticated,
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId && isAuthenticated,
  });

  const { data: eventWines = [] } = useQuery({
    queryKey: ["wines", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines_with_price_privacy").select("*").eq("event_id", eventId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data as WineWithPricePrivacy[];
    },
    enabled: !!eventId && isAuthenticated,
  });

  const isHost = event?.created_by === member?.id;
  const isDoubleBlind = event?.tasting_mode === "double_blind" && event?.status === "active";
  const hideDetails = isDoubleBlind && !isHost;
  const showBottleImage = !!wine && (!isDoubleBlind || isHost);
  const wineIndex = eventWines.findIndex((w) => w.id === wineId);
  const blindLabel = wineIndex >= 0 ? `Wine #${wineIndex + 1}` : "Wine";

  const { data: round } = useQuery({
    queryKey: ["ratingRound", eventId, wineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rating_rounds")
        .select("*")
        .eq("event_id", eventId!)
        .eq("wine_id", wineId!)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RatingRound | null;
    },
    enabled: !!eventId && !!wineId && isAuthenticated,
    refetchInterval: 4_000,
  });

  const { data: existingRating } = useQuery({
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
    enabled: !!wineId && !!userId && isAuthenticated,
  });

  const { data: eventFavorite, refetch: refetchFavorite } = useQuery({
    queryKey: ["event_favorite", eventId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_favorites")
        .select("wine_id")
        .eq("event_id", eventId!)
        .eq("member_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { wine_id: string } | null;
    },
    enabled: !!eventId && !!userId && isAuthenticated,
  });

  useEffect(() => {
    if (!eventId || !wineId || !isAuthenticated) return;

    const flowKey = `${eventId}:${wineId}`;
    if (trackedRatingFlowRef.current === flowKey) return;
    trackedRatingFlowRef.current = flowKey;

    trackEvent("rating_flow_started", {
      platform: Platform.OS,
      event_id: eventId,
      wine_id: wineId,
      source: "rating_screen",
    });
  }, [eventId, isAuthenticated, wineId]);

  useEffect(() => {
    if (existingRating) {
      if (existingRating.value != null) setVote(existingRating.value as Vote);
      if (existingRating.body) setBody(existingRating.body as BodyOption);
      if (existingRating.sweetness) setSweetness(existingRating.sweetness as SweetnessOption);
      if (existingRating.confidence != null) setConfidence(existingRating.confidence);
      if (existingRating.tags?.length) setSelectedTags(existingRating.tags as RatingTag[]);
      if (existingRating.note) setNote(existingRating.note);
    }
  }, [existingRating]);

  const isFavorite = eventFavorite?.wine_id === wineId;

  const toggleFavorite = async () => {
    if (!userId || !eventId || !wineId) return;
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("event_favorites")
          .delete()
          .eq("event_id", eventId)
          .eq("member_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_favorites").upsert(
          { event_id: eventId, member_id: userId, wine_id: wineId },
          { onConflict: "event_id,member_id" }
        );
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["event_favorite", eventId, userId] });
      refetchFavorite();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : (e && typeof e === "object" && "message" in e) ? String((e as { message: unknown }).message) : "Could not update favorite.";
      showAlert("Error", msg);
    }
  };

  const submit = async () => {
    if (!userId) {
      showAlert("Sign in to vote", "You need to be signed in to rate this wine.");
      return;
    }
    if (vote === null) {
      showAlert("Choose a rating", "Select Dislike, Meh, or Like before submitting.");
      return;
    }
    if (!wineId || !round) {
      showAlert(
        "Can't submit",
        round ? "Something went wrong — try going back and opening Rate again." : "This round is no longer active."
      );
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await supabase.from("ratings").upsert(
        {
          wine_id: wineId,
          member_id: userId,
          value: vote,
          body: body ?? null,
          sweetness: sweetness ?? null,
          confidence: confidence != null ? Math.round(confidence * 100) / 100 : null,
          tags: selectedTags,
          note: note.trim() || null,
        },
        { onConflict: "wine_id,member_id" }
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ratingRound", eventId, wineId] });
      queryClient.invalidateQueries({ queryKey: ["rating", wineId, userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", "ratings"] });
      trackEvent("wine_rated", {
        event_id: eventId,
        wine_id: wineId,
        value: vote,
        platform: Platform.OS,
        source: "rating_screen",
      });
      showAlert("Vote recorded!", "Thanks for rating.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : (e && typeof e === "object" && "message" in e) ? String((e as { message: unknown }).message) : "Could not submit vote";
      showAlert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!sessionLoaded) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  if (sessionLoaded && !session) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      </View>
    );
  }

  if (!wine) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  const canVote = !!member && round?.is_active && !submitting;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "Rate Wine" }} />
      {/* Wine header */}
      <View style={styles.wineHeader}>
        {showBottleImage ? (
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
        ) : null}
        <Text style={[styles.wineName, { color: theme.text }]}>
          {hideDetails ? blindLabel : (wine.producer ?? "Unknown")}
        </Text>
        <Text style={[styles.wineSubtitle, { color: theme.textSecondary }]}>
          {hideDetails
            ? "DETAILS HIDDEN"
            : [wine.varietal, wine.vintage?.toString()].filter(Boolean).join(" · ").toUpperCase()}
        </Text>
        {eventId && userId && (
          <TouchableOpacity onPress={toggleFavorite} style={styles.favoriteBtn} hitSlop={12}>
            <Ionicons name={isFavorite ? "star" : "star-outline"} size={24} color={isFavorite ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!member ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      ) : !round ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>Ask the host to start a rating round for this wine.</Text>
      ) : round.ended_at ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>This round has ended.</Text>
      ) : (
        <>
          <Text style={[styles.windowHint, { color: theme.textMuted }]}>
            This rating window closes automatically after {round.duration_minutes} minutes.
          </Text>
          {/* Vote section */}
          <Text style={[styles.sectionHeadingCentered, { color: theme.text }]}>How was this wine?</Text>
          <RatingVoteSelector value={vote} onChange={setVote} disabled={!canVote} />

          {/* Body */}
          <View style={styles.section}>
            <RatingSectionHeader
              title="Body"
              infoKey="body"
              value={body ? body.toUpperCase() : null}
              onOpenInfo={setActiveInfoKey}
              marginBottom={12}
            />
            <SegmentedControl options={BODY_OPTIONS} value={body} onChange={setBody} theme={theme} />
          </View>

          {/* Dryness */}
          <View style={styles.section}>
            <RatingSectionHeader
              title="Dryness"
              infoKey="dryness"
              value={sweetness ? sweetness.toUpperCase() : null}
              onOpenInfo={setActiveInfoKey}
              marginBottom={12}
            />
            <SegmentedControl options={SWEETNESS_OPTIONS} value={sweetness} onChange={setSweetness} theme={theme} />
          </View>

          {/* Confidence */}
          <View style={styles.section}>
            <RatingSectionHeader
              title="Confidence"
              infoKey="confidence"
              value={`${Math.round((confidence ?? 0.5) * 100)}% Sure`}
              onOpenInfo={setActiveInfoKey}
              marginBottom={12}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={confidence ?? 0.5}
              onValueChange={(v) => setConfidence(v)}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
            <View style={styles.sliderLabelsRow}>
              <Text style={[styles.sliderLabel, { color: theme.textMuted }]}>GUESSING</Text>
              <Text style={[styles.sliderLabel, { color: theme.textMuted }]}>CERTAIN</Text>
            </View>
          </View>

          {/* Tasting Notes */}
          <View style={styles.section}>
            <RatingSectionHeader
              title="Tasting Notes"
              infoKey="tastingNotes"
              onOpenInfo={setActiveInfoKey}
              marginBottom={12}
            />
            <View style={styles.tagGrid}>
              {RATING_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <TouchableOpacity
                    key={tag.value}
                    style={[
                      styles.tagChip,
                      { borderColor: theme.border },
                      selected && { borderColor: theme.primary, backgroundColor: theme.primary + "20" },
                    ]}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag.value) ? prev.filter((t) => t !== tag.value) : [...prev, tag.value]
                      )
                    }
                  >
                    <Text style={[styles.tagChipText, { color: selected ? theme.primary : theme.textSecondary }]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.noteInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              placeholder="Any additional thoughts on this vintage?"
              placeholderTextColor={theme.textMuted}
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary },
              (!canVote || vote === null || submitting) && { opacity: 0.6 },
            ]}
            onPress={submit}
            disabled={!canVote || vote === null || submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? "Submitting…" : "Submit rating  ›"}</Text>
          </TouchableOpacity>
          <RatingInfoModal
            infoKey={activeInfoKey}
            visible={activeInfoKey != null}
            onClose={() => setActiveInfoKey(null)}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 24, justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  // Wine header
  wineHeader: { alignItems: "center", paddingVertical: 16, marginBottom: 8 },
  wineName: { fontSize: 22, fontFamily: "PlayfairDisplay_700Bold_Italic", textAlign: "center", marginBottom: 4 },
  wineSubtitle: { fontSize: 12, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1.5, textAlign: "center" },
  favoriteBtn: { marginTop: 8, padding: 4 },

  // Vote
  sectionHeadingCentered: { fontSize: 20, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center", marginBottom: 16 },

  // Sections
  section: { marginBottom: 24 },

  // Slider
  slider: { width: "100%", height: 40 },
  sliderLabelsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  sliderLabel: { fontSize: 10, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1 },

  // Tags
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tagChip: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  tagChipText: { fontSize: 14, fontFamily: "Montserrat_600SemiBold" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },

  // Submit
  submitButton: { borderRadius: 28, padding: 16, alignItems: "center", marginTop: 4 },
  submitButtonText: { color: "#fff", fontSize: 16, fontFamily: "Montserrat_600SemiBold" },

  windowHint: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  hint: { textAlign: "center", fontSize: 15, fontFamily: "Montserrat_400Regular", padding: 8 },
  placeholder: { textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
