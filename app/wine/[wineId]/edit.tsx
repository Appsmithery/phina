import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Wine } from "@/types/database";

const LABEL_PHOTOS_BUCKET = "label-photos";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function EditWineScreen() {
  const { wineId } = useLocalSearchParams<{ wineId: string }>();
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
  const [replacingPhoto, setReplacingPhoto] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .eq("id", wineId!)
        .single();
      if (error) throw error;
      return data as Wine;
    },
    enabled: !!wineId,
  });

  useEffect(() => {
    if (wine) {
      setProducer(wine.producer ?? "");
      setVarietal(wine.varietal ?? "");
      setVintage(wine.vintage != null ? String(wine.vintage) : "");
      setRegion(wine.region ?? "");
      setAiSummary(wine.ai_summary ?? "");
      setQuantity(wine.quantity ?? 1);
      setLocalPhotoUrl(wine.label_photo_url ?? null);
    }
  }, [wine]);

  const displayPhotoUrl = localPhotoUrl ?? wine?.label_photo_url ?? null;

  const replacePhoto = async () => {
    if (!wineId || !member?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to choose a label image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    setReplacingPhoto(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const path = `${member.id}/${wineId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(LABEL_PHOTOS_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(LABEL_PHOTOS_BUCKET).getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from("wines")
        .update({ label_photo_url: publicUrl })
        .eq("id", wineId);
      if (updateError) throw updateError;
      setLocalPhotoUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      if (wine?.event_id) {
        queryClient.invalidateQueries({ queryKey: ["wines", wine.event_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["library", "my-wines", member.id] });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setReplacingPhoto(false);
    }
  };

  const save = async () => {
    if (!wineId || !member?.id) return;
    if (
      !producer.trim() &&
      !varietal.trim() &&
      !region.trim() &&
      !aiSummary.trim()
    ) {
      Alert.alert(
        "Add at least one detail",
        "Enter producer, varietal, region, or background so the wine can be identified."
      );
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("wines")
        .update({
          producer: producer.trim() || null,
          varietal: varietal.trim() || null,
          vintage: vintage ? parseInt(vintage, 10) : null,
          region: region.trim() || null,
          ai_summary: aiSummary.trim() || null,
          quantity,
        })
        .eq("id", wineId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      if (wine?.event_id) {
        queryClient.invalidateQueries({ queryKey: ["wines", wine.event_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["library", "my-wines", member.id] });
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setLoading(false);
    }
  };

  const isFormBlank =
    !producer.trim() && !varietal.trim() && !region.trim() && !aiSummary.trim();

  if (!wineId || isLoading || !wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {isLoading ? "Loading…" : "Wine not found."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: theme.text }]}>Edit wine</Text>
          {(displayPhotoUrl || replacingPhoto) && (
            <View style={styles.photoSection}>
              {displayPhotoUrl ? (
                <Image
                  source={{ uri: displayPhotoUrl }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              ) : replacingPhoto ? (
                <View style={[styles.photoPlaceholder, { borderColor: theme.border }]}>
                  <Text style={[styles.photoPlaceholderText, { color: theme.textMuted }]}>Uploading…</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.replacePhotoButton, { borderColor: theme.border }]}
                onPress={replacePhoto}
                disabled={replacingPhoto}
              >
                <Text style={[styles.replacePhotoButtonText, { color: theme.textSecondary }]}>
                  {displayPhotoUrl ? "Replace photo" : "Add label photo"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {!displayPhotoUrl && !replacingPhoto && (
            <TouchableOpacity
              style={[styles.replacePhotoButton, { borderColor: theme.border, marginBottom: 16 }]}
              onPress={replacePhoto}
            >
              <Text style={[styles.replacePhotoButtonText, { color: theme.textSecondary }]}>Add label photo</Text>
            </TouchableOpacity>
          )}
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
            <Text style={[styles.label, { color: theme.textSecondary }]}>Background (from label)</Text>
            <TextInput
              style={[styles.input, styles.summaryInput, { color: theme.text, borderColor: theme.border }]}
              value={aiSummary}
              onChangeText={setAiSummary}
              placeholder="Optional summary"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary, opacity: isFormBlank ? 0.5 : 1 },
              ]}
              onPress={save}
              disabled={loading || isFormBlank}
            >
              <Text style={styles.buttonText}>{loading ? "Saving…" : "Save changes"}</Text>
            </TouchableOpacity>
            {isFormBlank ? (
              <Text style={[styles.hintBlank, { color: theme.textSecondary }]}>
                Enter at least producer, varietal, region, or background.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  placeholder: { padding: 24 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  photoSection: { marginBottom: 16 },
  photo: { width: "100%", height: 200, borderRadius: 14, marginBottom: 8 },
  photoPlaceholder: { width: "100%", height: 200, borderRadius: 14, borderWidth: 1, marginBottom: 8, justifyContent: "center", alignItems: "center" },
  photoPlaceholderText: { fontSize: 14 },
  replacePhotoButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  replacePhotoButtonText: { fontSize: 16, fontWeight: "500" },
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
  hintBlank: { fontSize: 12, marginTop: 8, textAlign: "center" },
});
