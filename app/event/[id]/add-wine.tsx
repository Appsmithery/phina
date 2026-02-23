import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";
import { takeLastLabelExtraction } from "@/lib/last-label-extraction";

export default function AddWineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [producer, setProducer] = useState("");
  const [varietal, setVarietal] = useState("");
  const [vintage, setVintage] = useState("");
  const [region, setRegion] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const extracted = takeLastLabelExtraction();
      if (extracted) {
        setProducer(extracted.producer ?? "");
        setVarietal(extracted.varietal ?? "");
        setVintage(extracted.vintage != null ? String(extracted.vintage) : "");
        setRegion(extracted.region ?? "");
        setAiSummary(extracted.ai_summary ?? "");
      }
    }, [])
  );

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
        ai_summary: aiSummary.trim() || null,
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

  const openScan = () => {
    if (id) router.push(`/event/${id}/scan-label`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Add wine</Text>
      <TouchableOpacity style={[styles.scanButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={openScan}>
        <Text style={[styles.scanButtonText, { color: theme.primary }]}>Scan label</Text>
        <Text style={[styles.scanHint, { color: theme.textSecondary }]}>Use AI to fill fields from a photo</Text>
      </TouchableOpacity>
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
        {aiSummary ? (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Background (from label)</Text>
            <TextInput
              style={[styles.input, styles.summaryInput, { color: theme.text, borderColor: theme.border }]}
              value={aiSummary}
              onChangeText={setAiSummary}
              placeholder="Optional summary"
              multiline
            />
          </>
        ) : null}
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
  scanButton: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  scanButtonText: { fontSize: 16, fontWeight: "600" },
  scanHint: { fontSize: 12, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  summaryInput: { minHeight: 72 },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
