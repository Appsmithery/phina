import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Slider from "@react-native-community/slider";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import type { WineWithPricePrivacy } from "@/types/database";
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

export default function PersonalRateWineScreen() {
  const params = useLocalSearchParams<{ wineId: string }>();
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
  const queryClient = useQueryClient();

  const userId = session?.user?.id ?? member?.id;
  const isAuthenticated = sessionLoaded && !!session;

  const { data: wine } = useQuery({
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
    enabled: !!wineId && isAuthenticated,
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

  const submit = async () => {
    if (!userId) {
      showAlert("Sign in to rate", "You need to be signed in to rate this wine.");
      return;
    }
    if (vote === null) {
      showAlert("Choose a rating", "Select Down, Meh, or Up before submitting.");
      return;
    }
    if (!wineId) {
      showAlert("Error", "Wine not found.");
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
      // Auto-mark wine as consumed when rated
      if (wine && wine.status !== "consumed") {
        await supabase
          .from("wines")
          .update({ status: "consumed", date_consumed: new Date().toISOString().split("T")[0] })
          .eq("id", wineId);
      }
      queryClient.invalidateQueries({ queryKey: ["rating", wineId, userId] });
      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", "ratings"] });
      showAlert("Rating saved!", "Thanks for rating.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : (e && typeof e === "object" && "message" in e)
            ? String((e as { message: unknown }).message)
            : "Could not submit rating";
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

  const canVote = !!member && !submitting;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "Rate Wine" }} />
      {/* Wine header */}
      <View style={styles.wineHeader}>
        <Text style={[styles.wineName, { color: theme.text }]}>
          {wine.producer ?? "Unknown"}
        </Text>
        <Text style={[styles.wineSubtitle, { color: theme.textSecondary }]}>
          {[wine.varietal, wine.vintage?.toString()].filter(Boolean).join(" · ").toUpperCase()}
        </Text>
      </View>

      {!member ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      ) : (
        <>
          {/* Vote section */}
          <Text style={[styles.sectionHeadingCentered, { color: theme.text }]}>How was this wine?</Text>
          <View style={styles.voteRow}>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.background, borderColor: theme.border },
                vote === -1 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => canVote && setVote(-1)}
              disabled={!canVote}
            >
              <Ionicons name="thumbs-down" size={28} color={vote === -1 ? theme.thumbsDown : theme.textMuted} />
              <Text style={[styles.voteLabel, { color: vote === -1 ? theme.thumbsDown : theme.textMuted }]}>Down</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.background, borderColor: theme.border },
                vote === 0 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => canVote && setVote(0)}
              disabled={!canVote}
            >
              <MaterialCommunityIcons name="emoticon-neutral-outline" size={28} color={vote === 0 ? theme.meh : theme.textMuted} />
              <Text style={[styles.voteLabel, { color: vote === 0 ? theme.meh : theme.textMuted }]}>Meh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.background, borderColor: theme.border },
                vote === 1 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => canVote && setVote(1)}
              disabled={!canVote}
            >
              <Ionicons name="thumbs-up" size={28} color={vote === 1 ? theme.thumbsUp : theme.textMuted} />
              <Text style={[styles.voteLabel, { color: vote === 1 ? theme.thumbsUp : theme.textMuted }]}>Up</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Body</Text>
              {body && (
                <Text style={[styles.sectionValue, { color: theme.primary }]}>
                  {body.toUpperCase()}
                </Text>
              )}
            </View>
            <SegmentedControl options={BODY_OPTIONS} value={body} onChange={setBody} theme={theme} />
          </View>

          {/* Dryness */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Dryness</Text>
              {sweetness && (
                <Text style={[styles.sectionValue, { color: theme.primary }]}>
                  {sweetness.toUpperCase()}
                </Text>
              )}
            </View>
            <SegmentedControl options={SWEETNESS_OPTIONS} value={sweetness} onChange={setSweetness} theme={theme} />
          </View>

          {/* Confidence */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Confidence</Text>
              <Text style={[styles.sectionValue, { color: theme.primary }]}>
                {`${Math.round((confidence ?? 0.5) * 100)}% Sure`}
              </Text>
            </View>
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
            <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: 12 }]}>Tasting Notes</Text>
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
              (vote === null || submitting) && { opacity: 0.6 },
            ]}
            onPress={submit}
            disabled={vote === null || submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? "Submitting…" : "Submit rating  ›"}</Text>
          </TouchableOpacity>
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

  // Vote
  sectionHeadingCentered: { fontSize: 20, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center", marginBottom: 16 },
  voteRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  voteBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 22,
    alignItems: "center",
    gap: 6,
  },
  voteLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },

  // Sections
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionHeading: { fontSize: 20, fontFamily: "PlayfairDisplay_700Bold" },
  sectionValue: { fontSize: 13, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1 },

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

  hint: { textAlign: "center", fontSize: 15, fontFamily: "Montserrat_400Regular", padding: 8 },
  placeholder: { textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
