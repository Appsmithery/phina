import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/observability";

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

export default function CreateEventScreen() {
  const { session } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [themeText, setThemeText] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const date = selectedDate.toISOString().slice(0, 10);

  const onDateChange = (_event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (picked) setSelectedDate(picked);
  };

  const create = async () => {
    if (!session?.user?.id || !title.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          theme: themeText.trim() || "Tasting",
          date,
          status: "active",
          created_by: session.user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Auto-join the host as a member of their own event
      const { error: memberError } = await supabase
        .from("event_members")
        .upsert(
          { event_id: data.id, member_id: session.user.id, checked_in: true },
          { onConflict: "event_id,member_id" }
        );
      if (memberError) console.warn("[create-event] host auto-join failed:", memberError.message);

      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] });
      trackEvent("event_created", { event_id: data.id });
      router.replace(`/event/${data.id}`);
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
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Theme</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={themeText}
          onChangeText={setThemeText}
          placeholder="e.g. alpine"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
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
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={create}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Creating…" : "Create"}</Text>
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
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  dateInput: { justifyContent: "center" },
  dateText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  doneButton: { borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 16 },
  doneButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
});
