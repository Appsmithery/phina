import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
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
type RatingTag = "minerality" | "fruit" | "spice" | "tannic";

const RATING_TAGS: { label: string; value: RatingTag }[] = [
  { label: "Minerality", value: "minerality" },
  { label: "Fruit", value: "fruit" },
  { label: "Spice", value: "spice" },
  { label: "Tannic", value: "tannic" },
];

const BODY_OPTIONS: { label: string; value: BodyOption }[] = [
  { label: "Light", value: "light" },
  { label: "Medium", value: "medium" },
  { label: "Full", value: "full" },
];
const SWEETNESS_OPTIONS: { label: string; value: SweetnessOption }[] = [
  { label: "Dry", value: "dry" },
  { label: "Off-dry", value: "off-dry" },
  { label: "Sweet", value: "sweet" },
];

const BODY_HELP =
  "How heavy or rich the wine feels in the mouth—weight and texture, not flavor. Light = delicate, thin; Medium = middle of the road; Full = bold, viscous.";
const DRYNESS_HELP =
  "Perceived sweetness. Dry = little to no sugar; Off-dry = a touch of sweetness; Sweet = noticeably sweet. Skip if you prefer not to rate.";
const CONFIDENCE_HELP =
  "How sure you are about this rating. Slide right for more confidence, left for less. Use None to leave unset—only set it if you want it included.";

type HelpKey = "body" | "dryness" | "confidence";

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
              selected && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => onChange(selected ? null : opt.value)}
          >
            <Text
              style={[
                segStyles.pillText,
                { color: theme.textSecondary },
                selected && { color: "#fff" },
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
    paddingVertical: 8,
    alignItems: "center",
  },
  pillText: { fontSize: 13, fontFamily: "Montserrat_600SemiBold" },
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
  const [expandedHelp, setExpandedHelp] = useState<HelpKey | null>(null);
  const queryClient = useQueryClient();

  const toggleHelp = (key: HelpKey) => setExpandedHelp((prev) => (prev === key ? null : key));

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
  const photoUrl = wine.display_photo_url ?? wine.label_photo_url;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent}>
      {/* Wine hero card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.wineHeroRow}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.wineThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.wineThumbPlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="wine-outline" size={28} color={theme.textMuted} />
            </View>
          )}
          <View style={styles.wineInfo}>
            <Text style={[styles.wineProducer, { color: theme.text }]} numberOfLines={2}>
              {wine.producer ?? "Unknown"}
            </Text>
            <Text style={[styles.wineMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              {[wine.varietal, wine.vintage?.toString(), wine.region].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      </View>

      {!member ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      ) : (
        <>
          {/* Vote card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>How was it?</Text>
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  { backgroundColor: theme.thumbsDown + "15", borderColor: theme.thumbsDown + "40" },
                  vote === -1 && { backgroundColor: theme.thumbsDown, borderColor: theme.thumbsDown },
                ]}
                onPress={() => canVote && setVote(-1)}
                disabled={!canVote}
              >
                <Ionicons name="thumbs-down" size={28} color={vote === -1 ? "#fff" : theme.thumbsDown} />
                <Text style={[styles.voteLabel, { color: vote === -1 ? "#fff" : theme.thumbsDown }]}>Down</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  { backgroundColor: theme.meh + "15", borderColor: theme.meh + "40" },
                  vote === 0 && { backgroundColor: theme.meh, borderColor: theme.meh },
                ]}
                onPress={() => canVote && setVote(0)}
                disabled={!canVote}
              >
                <MaterialCommunityIcons name="scale-balance" size={28} color={vote === 0 ? "#fff" : theme.meh} />
                <Text style={[styles.voteLabel, { color: vote === 0 ? "#fff" : theme.meh }]}>Meh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  { backgroundColor: theme.thumbsUp + "15", borderColor: theme.thumbsUp + "40" },
                  vote === 1 && { backgroundColor: theme.thumbsUp, borderColor: theme.thumbsUp },
                ]}
                onPress={() => canVote && setVote(1)}
                disabled={!canVote}
              >
                <Ionicons name="thumbs-up" size={28} color={vote === 1 ? "#fff" : theme.thumbsUp} />
                <Text style={[styles.voteLabel, { color: vote === 1 ? "#fff" : theme.thumbsUp }]}>Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Details card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Details</Text>

            <TouchableOpacity style={styles.labelRow} onPress={() => toggleHelp("body")} activeOpacity={0.7}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Body</Text>
              <Ionicons
                name={expandedHelp === "body" ? "chevron-up" : "information-circle-outline"}
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>
            {expandedHelp === "body" && (
              <Text style={[styles.helperText, { color: theme.textMuted }]}>{BODY_HELP}</Text>
            )}
            <SegmentedControl options={BODY_OPTIONS} value={body} onChange={setBody} theme={theme} />

            <View style={styles.fieldSpacer} />

            <TouchableOpacity style={styles.labelRow} onPress={() => toggleHelp("dryness")} activeOpacity={0.7}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Dryness</Text>
              <Ionicons
                name={expandedHelp === "dryness" ? "chevron-up" : "information-circle-outline"}
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>
            {expandedHelp === "dryness" && (
              <Text style={[styles.helperText, { color: theme.textMuted }]}>{DRYNESS_HELP}</Text>
            )}
            <SegmentedControl options={SWEETNESS_OPTIONS} value={sweetness} onChange={setSweetness} theme={theme} />

            <View style={styles.fieldSpacer} />

            <TouchableOpacity style={styles.labelRow} onPress={() => toggleHelp("confidence")} activeOpacity={0.7}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Confidence</Text>
              <Ionicons
                name={expandedHelp === "confidence" ? "chevron-up" : "information-circle-outline"}
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>
            {expandedHelp === "confidence" && (
              <Text style={[styles.helperText, { color: theme.textMuted }]}>{CONFIDENCE_HELP}</Text>
            )}
            <View style={styles.sliderRow}>
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
              <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                {confidence != null ? `${Math.round(confidence * 100)}%` : "—"}
              </Text>
              <TouchableOpacity
                onPress={() => setConfidence(null)}
                style={[styles.confidenceNoneBtn, confidence === null && { opacity: 0.5 }]}
              >
                <Text style={[styles.confidenceNoneText, { color: theme.textMuted }]}>None</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tasting notes card */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Tasting notes</Text>
            <View style={styles.tagGrid}>
              {RATING_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <TouchableOpacity
                    key={tag.value}
                    style={[
                      styles.tagChip,
                      { borderColor: theme.primary },
                      selected && { backgroundColor: theme.primary },
                    ]}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag.value) ? prev.filter((t) => t !== tag.value) : [...prev, tag.value]
                      )
                    }
                  >
                    <Text style={[styles.tagChipText, { color: selected ? "#fff" : theme.primary }]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.noteInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
              placeholder="Any notes…"
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
            <Text style={styles.submitButtonText}>{submitting ? "Submitting…" : "Submit rating"}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 24, justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 12,
  },

  // Wine hero
  wineHeroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  wineThumb: { width: 64, height: 80, borderRadius: 10 },
  wineThumbPlaceholder: {
    width: 64,
    height: 80,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  wineInfo: { flex: 1 },
  wineProducer: { fontSize: 18, fontFamily: "PlayfairDisplay_700Bold", marginBottom: 2 },
  wineMeta: { fontSize: 13, fontFamily: "Montserrat_400Regular" },

  // Vote
  voteRow: { flexDirection: "row", gap: 10 },
  voteBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  voteLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },

  // Fields
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
  fieldSpacer: { height: 16 },
  helperText: { fontSize: 11, lineHeight: 16, marginBottom: 8, fontFamily: "Montserrat_300Light" },

  // Slider
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  slider: { flex: 1, height: 40 },
  sliderValue: { fontSize: 13, minWidth: 32, fontFamily: "Montserrat_400Regular" },
  confidenceNoneBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  confidenceNoneText: { fontSize: 13, fontFamily: "Montserrat_400Regular" },

  // Tags
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tagChip: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  tagChipText: { fontSize: 13, fontFamily: "Montserrat_600SemiBold" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    minHeight: 56,
    textAlignVertical: "top",
  },

  // Submit
  submitButton: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  submitButtonText: { color: "#fff", fontSize: 16, fontFamily: "Montserrat_600SemiBold" },

  hint: { textAlign: "center", fontSize: 15, fontFamily: "Montserrat_400Regular", padding: 8 },
  placeholder: { textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
