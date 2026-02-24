import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useQueryClient } from "@tanstack/react-query";
import { takeLastLabelExtraction } from "@/lib/last-label-extraction";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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
  const [quantity, setQuantity] = useState(1);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
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
        quantity: quantity,
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
      <TouchableOpacity
        style={[styles.backRow, { marginBottom: 8 }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={theme.primary} />
        <Text style={[styles.backText, { color: theme.primary }]}>Back</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: theme.text }]}>Add wine</Text>
      <TouchableOpacity style={[styles.scanButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={openScan}>
        <Text style={[styles.scanButtonText, { color: theme.primary }]}>Scan label</Text>
        <Text style={[styles.scanHint, { color: theme.textSecondary }]}>Use AI to fill fields from a photo</Text>
      </TouchableOpacity>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Quantity</Text>
        <TouchableOpacity
          style={[styles.input, styles.quantityTouchable, { borderColor: theme.border }]}
          onPress={() => setQuantityModalVisible(true)}
        >
          <Text style={{ color: theme.text, fontSize: 16 }}>{quantity}</Text>
        </TouchableOpacity>
        <Modal
          visible={quantityModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQuantityModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setQuantityModalVisible(false)}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Quantity</Text>
              {QUANTITY_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.quantityOption, quantity === n && { backgroundColor: theme.primary + "20" }]}
                  onPress={() => {
                    setQuantity(n);
                    setQuantityModalVisible(false);
                  }}
                >
                  <Text style={[styles.quantityOptionText, { color: theme.text }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
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
  backRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { fontSize: 16, fontWeight: "600", marginLeft: 4 },
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
  quantityTouchable: { justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { borderWidth: 1, borderRadius: 14, padding: 16, maxHeight: 320 },
  modalTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  quantityOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  quantityOptionText: { fontSize: 16 },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
