import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
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
  const [bodyModalVisible, setBodyModalVisible] = useState(false);
  const [sweetnessModalVisible, setSweetnessModalVisible] = useState(false);
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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  if (sessionLoaded && !session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      </View>
    );
  }

  if (!wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  const canVote = !!member && !submitting;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>
          {wine.producer ?? "Unknown"} {wine.varietal ?? ""} {wine.vintage ?? ""}
        </Text>
      </View>
      {!member ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to rate.</Text>
      ) : (
        <>
          <Text style={[styles.prompt, { color: theme.text }]}>Your rating:</Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.thumbsDown },
                vote === -1 && { borderWidth: 3, borderColor: theme.primary },
              ]}
              onPress={() => canVote && setVote(-1)}
              disabled={!canVote}
            >
              <Ionicons name="thumbs-down" size={32} color="#fff" style={styles.voteIcon} />
              <Text style={styles.voteLabel}>Down</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.meh },
                vote === 0 && { borderWidth: 3, borderColor: theme.primary },
              ]}
              onPress={() => canVote && setVote(0)}
              disabled={!canVote}
            >
              <MaterialCommunityIcons name="scale-balance" size={32} color="#fff" style={styles.voteIcon} />
              <Text style={styles.voteLabel}>Meh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                { backgroundColor: theme.thumbsUp },
                vote === 1 && { borderWidth: 3, borderColor: theme.primary },
              ]}
              onPress={() => canVote && setVote(1)}
              disabled={!canVote}
            >
              <Ionicons name="thumbs-up" size={32} color="#fff" style={styles.voteIcon} />
              <Text style={styles.voteLabel}>Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.labelRow}
            onPress={() => toggleHelp("body")}
            activeOpacity={0.7}
          >
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Body (optional)</Text>
            <Ionicons
              name={expandedHelp === "body" ? "chevron-up" : "information-circle-outline"}
              size={18}
              color={theme.textMuted}
            />
          </TouchableOpacity>
          {expandedHelp === "body" && (
            <Text style={[styles.helperText, { color: theme.textMuted }]}>{BODY_HELP}</Text>
          )}
          <TouchableOpacity
            style={[styles.dropdown, { borderColor: theme.border }]}
            onPress={() => setBodyModalVisible(true)}
          >
            <Text style={[styles.dropdownText, { color: body ? theme.text : theme.textMuted }]}>
              {body ? BODY_OPTIONS.find((o) => o.value === body)?.label : "Choose body…"}
            </Text>
          </TouchableOpacity>
          <Modal visible={bodyModalVisible} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setBodyModalVisible(false)}>
              <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Body</Text>
                {BODY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.modalOption, body === opt.value && { backgroundColor: theme.primary + "20" }]}
                    onPress={() => {
                      setBody(opt.value);
                      setBodyModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.text }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setBody(null);
                    setBodyModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.textMuted }]}>None</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <TouchableOpacity
            style={styles.labelRow}
            onPress={() => toggleHelp("dryness")}
            activeOpacity={0.7}
          >
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Dryness (optional)</Text>
            <Ionicons
              name={expandedHelp === "dryness" ? "chevron-up" : "information-circle-outline"}
              size={18}
              color={theme.textMuted}
            />
          </TouchableOpacity>
          {expandedHelp === "dryness" && (
            <Text style={[styles.helperText, { color: theme.textMuted }]}>{DRYNESS_HELP}</Text>
          )}
          <TouchableOpacity
            style={[styles.dropdown, { borderColor: theme.border }]}
            onPress={() => setSweetnessModalVisible(true)}
          >
            <Text style={[styles.dropdownText, { color: sweetness ? theme.text : theme.textMuted }]}>
              {sweetness ? SWEETNESS_OPTIONS.find((o) => o.value === sweetness)?.label : "Choose dryness…"}
            </Text>
          </TouchableOpacity>
          <Modal visible={sweetnessModalVisible} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setSweetnessModalVisible(false)}>
              <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Dryness</Text>
                {SWEETNESS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.modalOption,
                      sweetness === opt.value && { backgroundColor: theme.primary + "20" },
                    ]}
                    onPress={() => {
                      setSweetness(opt.value);
                      setSweetnessModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.text }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setSweetness(null);
                    setSweetnessModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.textMuted }]}>None</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <TouchableOpacity
            style={styles.labelRow}
            onPress={() => toggleHelp("confidence")}
            activeOpacity={0.7}
          >
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Confidence (optional)</Text>
            <Ionicons
              name={expandedHelp === "confidence" ? "chevron-up" : "information-circle-outline"}
              size={18}
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
              style={[styles.confidenceNoneBtn, confidence === null && { opacity: 0.7 }]}
            >
              <Text style={[styles.confidenceNoneText, { color: theme.textMuted }]}>None</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.metaLabel, { color: theme.textSecondary, marginBottom: 10 }]}>Tasting notes (optional)</Text>
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
            style={[styles.noteInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="Any notes…"
            placeholderTextColor={theme.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={200}
            multiline
          />

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
  container: { flex: 1, padding: 24, justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700", flex: 1 },
  prompt: { fontSize: 16, textAlign: "center", marginBottom: 16 },
  buttons: { flexDirection: "row", justifyContent: "space-evenly", gap: 16, marginBottom: 24 },
  voteBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  voteIcon: { marginBottom: 8 },
  voteLabel: { color: "#fff", fontWeight: "600" },
  submitButton: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8, marginBottom: 16 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  metaLabel: { fontSize: 12, color: "inherit" },
  helperText: { fontSize: 11, lineHeight: 16, marginBottom: 10, paddingHorizontal: 2 },
  dropdown: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 },
  dropdownText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { borderWidth: 1, borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  modalOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  modalOptionText: { fontSize: 16 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  slider: { flex: 1, height: 40 },
  sliderValue: { fontSize: 14, minWidth: 36 },
  confidenceNoneBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  confidenceNoneText: { fontSize: 14 },
  hint: { textAlign: "center", fontSize: 16 },
  placeholder: { textAlign: "center" },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tagChip: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  tagChipText: { fontSize: 13, fontFamily: "Montserrat_600SemiBold" },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 56, marginBottom: 16, textAlignVertical: "top" },
});
