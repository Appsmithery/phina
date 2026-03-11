import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { Stack, useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { enhanceBottleImageInBackground } from "@/lib/bottle-image-background";
import { showAlert } from "@/lib/alert";
import { takeLastLabelExtraction, type WineAttributes } from "@/lib/last-label-extraction";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Wine } from "@/types/database";

let ImagePicker: typeof import("expo-image-picker") | undefined;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
}

const LABEL_PHOTOS_BUCKET = "label-photos";
const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const COLOR_OPTIONS: { label: string; value: "red" | "white" | "skin-contact" | null }[] = [
  { label: "Not set", value: null },
  { label: "Red", value: "red" },
  { label: "White", value: "white" },
  { label: "Rose / Orange", value: "skin-contact" },
];

export default function EditWineScreen() {
  const { wineId } = useLocalSearchParams<{ wineId: string }>();
  const { member } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [producer, setProducer] = useState("");
  const [varietal, setVarietal] = useState("");
  const [vintage, setVintage] = useState("");
  const [region, setRegion] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [color, setColor] = useState<"red" | "white" | "skin-contact" | null>(null);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [isSparkling, setIsSparkling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replacingPhoto, setReplacingPhoto] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [wineAttributes, setWineAttributes] = useState<WineAttributes | null>(null);
  const [aiGeography, setAiGeography] = useState("");
  const [aiProduction, setAiProduction] = useState("");
  const [aiTastingNotes, setAiTastingNotes] = useState("");
  const [aiPairings, setAiPairings] = useState("");

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as Wine;
    },
    enabled: !!wineId,
  });

  useEffect(() => {
    if (!wine) return;

    setProducer(wine.producer ?? "");
    setVarietal(wine.varietal ?? "");
    setVintage(wine.vintage != null ? String(wine.vintage) : "");
    setRegion(wine.region ?? "");
    setAiSummary(wine.ai_summary ?? "");
    setQuantity(wine.quantity ?? 1);
    setColor(wine.color ?? null);
    setIsSparkling(wine.is_sparkling ?? false);
    setLocalPhotoUrl(wine.label_photo_url ?? null);
    setWineAttributes(wine.wine_attributes ?? null);
    setAiGeography(wine.ai_geography ?? "");
    setAiProduction(wine.ai_production ?? "");
    setAiTastingNotes(wine.ai_tasting_notes ?? "");
    setAiPairings(wine.ai_pairings ?? "");
  }, [wine]);

  useFocusEffect(
    useCallback(() => {
      const extracted = takeLastLabelExtraction();
      if (!extracted) return;

      if (extracted.producer != null) setProducer(extracted.producer);
      if (extracted.varietal != null) setVarietal(extracted.varietal);
      if (extracted.vintage != null) setVintage(String(extracted.vintage));
      if (extracted.region != null) setRegion(extracted.region);
      if (extracted.ai_summary != null) setAiSummary(extracted.ai_summary);
      if (extracted.label_photo_url != null) setLocalPhotoUrl(extracted.label_photo_url);
      if (extracted.color != null) setColor(extracted.color);
      if (extracted.is_sparkling != null) setIsSparkling(extracted.is_sparkling);
      if (extracted.wine_attributes != null) setWineAttributes(extracted.wine_attributes);
      if (extracted.ai_geography != null) setAiGeography(extracted.ai_geography);
      if (extracted.ai_production != null) setAiProduction(extracted.ai_production);
      if (extracted.ai_tasting_notes != null) setAiTastingNotes(extracted.ai_tasting_notes);
      if (extracted.ai_pairings != null) setAiPairings(extracted.ai_pairings);
    }, [])
  );

  const displayPhotoUrl = localPhotoUrl ?? wine?.label_photo_url ?? null;

  const uploadPhotoBlob = async (blob: Blob) => {
    if (!wineId || !member?.id) return;

    setReplacingPhoto(true);
    try {
      const path = `${member.id}/${wineId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(LABEL_PHOTOS_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(LABEL_PHOTOS_BUCKET).getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from("wines").update({ label_photo_url: publicUrl }).eq("id", wineId);
      if (updateError) throw updateError;

      setLocalPhotoUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      if (wine?.event_id) {
        queryClient.invalidateQueries({ queryKey: ["wines", wine.event_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member.id] });
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setReplacingPhoto(false);
    }
  };

  const replacePhoto = async () => {
    if (!wineId || !member?.id) return;

    if (Platform.OS === "web") {
      webFileInputRef.current?.click();
      return;
    }

    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Permission needed", "Allow access to your photos to choose a label image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const response = await fetch(result.assets[0].uri);
    const blob = await response.blob();
    await uploadPhotoBlob(blob);
  };

  const handleWebFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadPhotoBlob(file);
      if (webFileInputRef.current) webFileInputRef.current.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wineId, member?.id, wine?.event_id]
  );

  const save = async () => {
    if (!wineId || !member?.id || !wine) return;
    if (!producer.trim() && !varietal.trim() && !region.trim() && !aiSummary.trim()) {
      showAlert(
        "Add at least one detail",
        "Enter producer, varietal, region, or background so the wine can be identified."
      );
      return;
    }

    setLoading(true);
    try {
      const currentWine = wine;
      const trimmedProducer = producer.trim() || null;
      const trimmedVarietal = varietal.trim() || null;
      const parsedVintage = vintage ? parseInt(vintage, 10) : null;
      const trimmedRegion = region.trim() || null;
      const trimmedAiSummary = aiSummary.trim() || null;
      const trimmedAiGeography = aiGeography.trim() || null;
      const trimmedAiProduction = aiProduction.trim() || null;
      const trimmedAiTastingNotes = aiTastingNotes.trim() || null;
      const trimmedAiPairings = aiPairings.trim() || null;
      const nextLabelPhotoUrl = localPhotoUrl ?? null;
      const photoChanged = nextLabelPhotoUrl !== (currentWine.label_photo_url ?? null);

      const { error } = await supabase
        .from("wines")
        .update({
          producer: trimmedProducer,
          varietal: trimmedVarietal,
          vintage: parsedVintage,
          region: trimmedRegion,
          ai_summary: trimmedAiSummary,
          quantity,
          color,
          is_sparkling: isSparkling,
          label_photo_url: nextLabelPhotoUrl,
          display_photo_url: photoChanged ? null : currentWine.display_photo_url,
          image_confidence_score: photoChanged ? null : currentWine.image_confidence_score,
          image_generation_status: photoChanged ? "pending" : currentWine.image_generation_status,
          image_generation_metadata: photoChanged ? null : currentWine.image_generation_metadata,
          ai_geography: trimmedAiGeography,
          ai_production: trimmedAiProduction,
          ai_tasting_notes: trimmedAiTastingNotes,
          ai_pairings: trimmedAiPairings,
          wine_attributes: wineAttributes,
        })
        .eq("id", wineId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      if (currentWine.event_id) {
        queryClient.invalidateQueries({ queryKey: ["wines", currentWine.event_id] });
      }
      queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member.id] });

      if (photoChanged && nextLabelPhotoUrl) {
        enhanceBottleImageInBackground({
          wineId,
          memberId: member.id,
          eventId: currentWine.event_id ?? null,
          rawImageUrl: nextLabelPhotoUrl,
          extraction: {
            producer: trimmedProducer,
            varietal: trimmedVarietal,
            vintage: parsedVintage,
            region: trimmedRegion,
            color,
            is_sparkling: isSparkling,
          },
          queryClient,
        });
      }

      router.back();
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setLoading(false);
    }
  };

  const isFormBlank = !producer.trim() && !varietal.trim() && !region.trim() && !aiSummary.trim();

  if (!wineId || isLoading || !wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Wine" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {isLoading ? "Loading..." : "Wine not found."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: "Edit Wine" }} />
      {Platform.OS === "web" ? (
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleWebFileChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
          style={{ display: "none" }}
        />
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(displayPhotoUrl || replacingPhoto) && (
            <View style={styles.photoSection}>
              {displayPhotoUrl ? (
                <Image source={{ uri: displayPhotoUrl }} style={styles.photo} resizeMode="contain" />
              ) : replacingPhoto ? (
                <View style={[styles.photoPlaceholder, { borderColor: theme.border }]}>
                  <Text style={[styles.photoPlaceholderText, { color: theme.textMuted }]}>Uploading...</Text>
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

          {!displayPhotoUrl && !replacingPhoto ? (
            <TouchableOpacity
              style={[styles.replacePhotoButton, { borderColor: theme.border, marginBottom: 16 }]}
              onPress={replacePhoto}
            >
              <Text style={[styles.replacePhotoButtonText, { color: theme.textSecondary }]}>Add label photo</Text>
            </TouchableOpacity>
          ) : null}

          {wineId ? (
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 16 }]}
              onPress={() =>
                router.push({
                  pathname: "/scan-label",
                  params: { returnTo: `/wine/${wineId}/edit`, scanMode: "prefill" },
                })
              }
            >
              <Text style={[styles.scanButtonText, { color: theme.primary }]}>Scan label</Text>
              <Text style={[styles.scanHint, { color: theme.textSecondary }]}>Use AI to fill fields from a photo</Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Quantity</Text>
            <TouchableOpacity
              style={[styles.input, styles.quantityTouchable, { borderColor: theme.border }]}
              onPress={() => setQuantityModalVisible(true)}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>{quantity}</Text>
            </TouchableOpacity>
            <Modal visible={quantityModalVisible} transparent animationType="fade" onRequestClose={() => setQuantityModalVisible(false)}>
              <Pressable style={styles.modalOverlay} onPress={() => setQuantityModalVisible(false)}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Quantity</Text>
                  {QUANTITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.quantityOption, quantity === option && { backgroundColor: `${theme.primary}20` }]}
                      onPress={() => {
                        setQuantity(option);
                        setQuantityModalVisible(false);
                      }}
                    >
                      <Text style={[styles.quantityOptionText, { color: theme.text }]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Color</Text>
            <TouchableOpacity
              style={[styles.input, styles.quantityTouchable, { borderColor: theme.border }]}
              onPress={() => setColorModalVisible(true)}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>
                {COLOR_OPTIONS.find((option) => option.value === color)?.label ?? "Not set"}
              </Text>
            </TouchableOpacity>
            <Modal visible={colorModalVisible} transparent animationType="fade" onRequestClose={() => setColorModalVisible(false)}>
              <Pressable style={styles.modalOverlay} onPress={() => setColorModalVisible(false)}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Color</Text>
                  {COLOR_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      style={[styles.quantityOption, color === option.value && { backgroundColor: `${theme.primary}20` }]}
                      onPress={() => {
                        setColor(option.value);
                        setColorModalVisible(false);
                      }}
                    >
                      <Text style={[styles.quantityOptionText, { color: theme.text }]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Sparkling</Text>
            <TouchableOpacity
              style={[styles.sparklingToggle, { borderColor: theme.border }]}
              onPress={() => setIsSparkling(!isSparkling)}
            >
              <Text style={[styles.sparklingToggleText, { color: theme.text }]}>{isSparkling ? "Yes" : "No"}</Text>
              <View style={[styles.sparklingIndicator, isSparkling && { backgroundColor: theme.primary }]} />
            </TouchableOpacity>

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
              style={[styles.button, { backgroundColor: theme.primary, opacity: isFormBlank ? 0.5 : 1 }]}
              onPress={save}
              disabled={loading || isFormBlank}
            >
              <Text style={styles.buttonText}>{loading ? "Saving..." : "Save changes"}</Text>
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
  placeholder: { padding: 24, fontFamily: "Montserrat_400Regular" },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  photoSection: { marginBottom: 16 },
  photo: { width: "100%", height: 200, borderRadius: 14, marginBottom: 8 },
  photoPlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  photoPlaceholderText: { fontSize: 14, fontFamily: "Montserrat_400Regular" },
  replacePhotoButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  replacePhotoButtonText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  scanButton: { borderWidth: 1, borderRadius: 14, padding: 16 },
  scanButtonText: { fontSize: 16, fontFamily: "Montserrat_600SemiBold" },
  scanHint: { fontSize: 12, marginTop: 4, fontFamily: "Montserrat_300Light" },
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
  summaryInput: { minHeight: 72 },
  quantityTouchable: { justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { borderWidth: 1, borderRadius: 14, padding: 16, maxHeight: 320 },
  modalTitle: { fontSize: 16, marginBottom: 12, fontFamily: "PlayfairDisplay_600SemiBold" },
  quantityOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  quantityOptionText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontFamily: "Montserrat_600SemiBold" },
  hintBlank: { fontSize: 12, marginTop: 8, textAlign: "center", fontFamily: "Montserrat_400Regular" },
  sparklingToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sparklingToggleText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  sparklingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5DDD6",
  },
});
