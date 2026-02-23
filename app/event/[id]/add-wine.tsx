import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";

export default function AddWineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [producer, setProducer] = useState("");
  const [varietal, setVarietal] = useState("");
  const [vintage, setVintage] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);

  const add = async () => {
    if (!member?.id || !id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("wines").insert({
        event_id: id,
        brought_by: member.id,
        producer: producer.trim() || null,
        varietal: varietal.trim() || null,
        vintage: vintage ? parseInt(vintage, 10) : null,
        region: region.trim() || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["wines", id] });
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not add wine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Add wine</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Producer</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={producer}
          onChangeText={setProducer}
          placeholder="Producer name"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Varietal</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={varietal}
          onChangeText={setVarietal}
          placeholder="e.g. Pinot Noir"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Vintage</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={vintage}
          onChangeText={setVintage}
          placeholder="e.g. 2020"
          keyboardType="number-pad"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Region</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={region}
          onChangeText={setRegion}
          placeholder="e.g. Burgundy"
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={add}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Adding…" : "Add wine"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
