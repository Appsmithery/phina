import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileScreen() {
  const { member, session, refreshMember } = useSupabase();
  const theme = useTheme();
  const [name, setName] = useState(member?.name ?? "");

  useEffect(() => {
    setName(member?.name ?? "");
  }, [member?.name]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const saveProfile = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email!,
            name: name.trim() || null,
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      await refreshMember();
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    supabase.auth.signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
        <Text style={[styles.value, { color: theme.text }]}>{session?.user?.email ?? "—"}</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.textMuted}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.signOut, { borderColor: theme.border }]} onPress={signOut}>
        <Text style={[styles.signOutText, { color: theme.textSecondary }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 16, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  signOut: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  signOutText: { fontSize: 16 },
});
