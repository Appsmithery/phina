import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateEventScreen() {
  const { session } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [themeText, setThemeText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace(`/event/${data.id}`);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not create event");
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
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />
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
});
