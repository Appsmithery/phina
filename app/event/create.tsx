import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";
import { generateEventImage } from "@/lib/event-image-generation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

export default function CreateEventScreen() {
  const { session } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [themeText, setThemeText] = useState("");
  const [description, setDescription] = useState("");
  const [partifulUrl, setPartifulUrl] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tastingMode, setTastingMode] = useState<"single_blind" | "double_blind">("single_blind");

  const date = selectedDate.toISOString().slice(0, 10);

  const onDateChange = (_event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (picked) setSelectedDate(picked);
  };

  const showSharePrompt = (eventId: string) => {
    const joinUrl = `${APP_BASE_URL}/join/${eventId}`;
    const shareMessage = `I'm using Phina for our wine tasting on ${formatDisplayDate(selectedDate)}! Set up your account before the event so you're ready to rate: ${joinUrl}`;

    showAlert(
      "Share in Partiful",
      "Post this in your Partiful event so guests can set up before the tasting.",
      [
        {
          text: "Copy Message",
          onPress: async () => {
            let copied = false;

            try {
              await Clipboard.setStringAsync(shareMessage);
              copied = true;
            } catch (error) {
              if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareMessage);
                copied = true;
              } else {
                console.warn("[create-event] clipboard copy failed:", error);
              }
            }

            showAlert(
              copied ? "Copied" : "Copy failed",
              copied
                ? "Message copied to clipboard. Paste it into your Partiful event."
                : "We could not copy the message automatically. You can still share your join link from the event page."
            );
            router.replace(`/event/${eventId}`);
          },
        },
        {
          text: "Skip",
          style: "cancel",
          onPress: () => router.replace(`/event/${eventId}`),
        },
      ]
    );
  };

  const create = async () => {
    if (!session?.user?.id || !title.trim()) return;

    setLoading(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedTheme = themeText.trim() || "Tasting";
      const trimmedPartifulUrl = partifulUrl.trim()
        ? (/^https?:\/\//i.test(partifulUrl.trim()) ? partifulUrl.trim() : `https://${partifulUrl.trim()}`)
        : null;
      const trimmedDescription = description.trim() || null;

      const { data, error } = await supabase
        .from("events")
        .insert({
          title: trimmedTitle,
          theme: trimmedTheme,
          date,
          status: "active",
          created_by: session.user.id,
          tasting_mode: tastingMode,
          description: trimmedDescription,
          partiful_url: trimmedPartifulUrl,
          event_image_status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      const { error: memberError } = await supabase
        .from("event_members")
        .upsert(
          { event_id: data.id, member_id: session.user.id, checked_in: true },
          { onConflict: "event_id,member_id" }
        );

      if (memberError) {
        console.warn("[create-event] host auto-join failed:", memberError.message);
      }

      void generateEventImage(data.id, trimmedTitle, trimmedTheme, trimmedDescription);

      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] });
      trackEvent("event_created", { event_id: data.id, has_partiful_url: !!trimmedPartifulUrl });

      showSharePrompt(data.id);
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: theme.text }]}>New event</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Title</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Alpine Night"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Theme</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={themeText}
              onChangeText={setThemeText}
              placeholder="e.g. Alpine, Burgundy Night, Rose"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: theme.text, borderColor: theme.border }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell your guests what to expect..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
            {Platform.OS === "web" ? (
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                value={date}
                onChange={(event: any) => {
                  const val = event?.target?.value;
                  if (val) setSelectedDate(new Date(`${val}T00:00:00`));
                }}
                // @ts-expect-error web-only prop
                type="date"
                min={new Date().toISOString().slice(0, 10)}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.input, styles.dateInput, { borderColor: theme.border }]}
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, { color: theme.text }]}>{formatDisplayDate(selectedDate)}</Text>
                </TouchableOpacity>
                {showPicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                    themeVariant="light"
                  />
                )}
                {showPicker && Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={[styles.doneButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowPicker(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary }]}>Partiful Link (optional)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={partifulUrl}
              onChangeText={setPartifulUrl}
              placeholder="partiful.com/e/..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Tasting Mode</Text>
            <View style={[styles.modeRow, { borderColor: theme.border }]}>
              {(["single_blind", "double_blind"] as const).map((mode) => {
                const active = tastingMode === mode;

                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modePill,
                      active && { backgroundColor: theme.primary },
                      !active && { backgroundColor: "transparent" },
                    ]}
                    onPress={() => setTastingMode(mode)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modePillText, { color: active ? "#fff" : theme.text }]}>
                      {mode === "single_blind" ? "Single Blind" : "Double Blind"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modeHint, { color: theme.textSecondary }]}>
              {tastingMode === "single_blind"
                ? "Guests see wine details but not results until the event ends."
                : "Guests see only wine numbers - details are revealed when the event ends."}
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={create}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? "Creating..." : "Create"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16, fontFamily: "PlayfairDisplay_700Bold" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 12, marginBottom: 4, fontFamily: "Montserrat_400Regular" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  dateInput: { justifyContent: "center" },
  dateText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  doneButton: { borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 16 },
  doneButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  modeRow: { flexDirection: "row", borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  modePill: { flex: 1, paddingVertical: 10, alignItems: "center" },
  modePillText: { fontSize: 14, fontFamily: "Montserrat_600SemiBold" },
  modeHint: { fontSize: 12, fontFamily: "Montserrat_400Regular", marginBottom: 16, lineHeight: 16 },
});
