import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import {
  takeLastLabelExtraction,
  type WineAttributes,
  type WineExtraction,
} from "@/lib/last-label-extraction";
import { enhanceBottleImageInBackground } from "@/lib/bottle-image-background";
import { useQueryClient } from "@tanstack/react-query";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const PRICE_RANGE_OPTIONS: { label: string; value: string | null }[] = [
  { label: "No range", value: null },
  { label: "<$20", value: "<$20" },
  { label: "20–35", value: "20-35" },
  { label: "35–50", value: "35-50" },
  { label: ">50", value: ">50" },
];

const COLOR_OPTIONS: { label: string; value: "red" | "white" | "skin-contact" | null }[] = [
  { label: "Not set", value: null },
  { label: "Red", value: "red" },
  { label: "White", value: "white" },
  { label: "Rose / Orange", value: "skin-contact" },
];

interface EnrichParams {
  wineId: string;
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
  region: string | null;
  color: "red" | "white" | "skin-contact" | null;
  isSparkling: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}

function enrichWineInBackground({
  wineId,
  producer,
  varietal,
  vintage,
  region,
  color,
  isSparkling,
  queryClient,
}: EnrichParams): void {
  (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-wine-summary", {
        body: { producer, varietal, vintage, region, color, is_sparkling: isSparkling },
      });
      if (error || !data) {
        if (__DEV__) console.warn("[add-wine] generate-wine-summary error:", error);
        return;
      }
      const summary = data as {
        ai_geography?: string | null;
        ai_production?: string | null;
        ai_tasting_notes?: string | null;
        ai_pairings?: string | null;
        drink_from?: number | null;
        drink_until?: number | null;
        wine_attributes?: WineAttributes | null;
      };
      const { error: patchError } = await supabase
        .from("wines")
        .update({
          ai_geography: summary.ai_geography ?? null,
          ai_production: summary.ai_production ?? null,
          ai_tasting_notes: summary.ai_tasting_notes ?? null,
          ai_pairings: summary.ai_pairings ?? null,
          drink_from: summary.drink_from ?? null,
          drink_until: summary.drink_until ?? null,
          wine_attributes: summary.wine_attributes ?? null,
        })
        .eq("id", wineId);
      if (patchError) {
        if (__DEV__) console.warn("[add-wine] patch AI fields error:", patchError);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
      if (__DEV__) console.log("[add-wine] background AI enrichment complete for", wineId);
    } catch (e) {
      if (__DEV__) console.warn("[add-wine] enrichWineInBackground error:", e);
    }
  })();
}

export type AddWineFormProps = {
  eventId: string | null;
  memberId: string;
  onSuccess: () => void | Promise<void>;
  onScan: () => void;
  submitButtonLabel?: string;
};

export function AddWineForm({
  eventId,
  memberId,
  onSuccess,
  onScan,
  submitButtonLabel = "Add wine",
}: AddWineFormProps) {
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
  const [priceCents, setPriceCents] = useState("");
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [priceRangeModalVisible, setPriceRangeModalVisible] = useState(false);
  const [color, setColor] = useState<"red" | "white" | "skin-contact" | null>(null);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [isSparkling, setIsSparkling] = useState(false);
  const [pendingLabelPhotoUrl, setPendingLabelPhotoUrl] = useState<string | null>(null);
  const [pendingDisplayPhotoUrl, setPendingDisplayPhotoUrl] = useState<string | null>(null);
  const [pendingImageConfidenceScore, setPendingImageConfidenceScore] = useState<number | null>(null);
  const [pendingImageGenerationStatus, setPendingImageGenerationStatus] =
    useState<WineExtraction["image_generation_status"]>(null);
  const [pendingImageGenerationMetadata, setPendingImageGenerationMetadata] = useState<Record<string, unknown> | null>(null);
  const [wineAttributes, setWineAttributes] = useState<WineAttributes | null>(null);
  const [aiGeography, setAiGeography] = useState("");
  const [aiProduction, setAiProduction] = useState("");
  const [aiTastingNotes, setAiTastingNotes] = useState("");
  const [aiPairings, setAiPairings] = useState("");
  const [drinkFrom, setDrinkFrom] = useState<number | null>(null);
  const [drinkUntil, setDrinkUntil] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      const extracted = takeLastLabelExtraction();
      if (extracted) {
        setProducer(extracted.producer ?? "");
        setVarietal(extracted.varietal ?? "");
        setVintage(extracted.vintage != null ? String(extracted.vintage) : "");
        setRegion(extracted.region ?? "");
        setAiSummary(extracted.ai_summary ?? "");
        setPendingLabelPhotoUrl(extracted.label_photo_url ?? null);
        setPendingDisplayPhotoUrl(extracted.display_photo_url ?? null);
        setPendingImageConfidenceScore(extracted.image_confidence_score ?? null);
        setPendingImageGenerationStatus(extracted.image_generation_status ?? null);
        setPendingImageGenerationMetadata(extracted.image_generation_metadata ?? null);
        if (extracted.color != null) setColor(extracted.color);
        if (extracted.is_sparkling != null) setIsSparkling(extracted.is_sparkling);
        setWineAttributes(extracted.wine_attributes ?? null);
        setAiGeography(extracted.ai_geography ?? "");
        setAiProduction(extracted.ai_production ?? "");
        setAiTastingNotes(extracted.ai_tasting_notes ?? "");
        setAiPairings(extracted.ai_pairings ?? "");
        if (extracted.drink_from != null) setDrinkFrom(extracted.drink_from);
        if (extracted.drink_until != null) setDrinkUntil(extracted.drink_until);
      }
    }, [])
  );

  const submit = async () => {
    if (!memberId) return;
    if (
      !producer.trim() &&
      !varietal.trim() &&
      !region.trim() &&
      !aiSummary.trim()
    ) {
      showAlert(
        "Add at least one detail",
        "Enter producer, varietal, region, or background so the wine can be identified."
      );
      return;
    }
    const parsedDollars = priceCents.trim() ? parseInt(priceCents.trim(), 10) : null;
    const priceCentsValue =
      parsedDollars != null && !Number.isNaN(parsedDollars) && parsedDollars >= 0
        ? Math.min(parsedDollars * 100, 9999900)
        : null;
    const trimmedProducer = producer.trim() || null;
    const trimmedVarietal = varietal.trim() || null;
    const parsedVintage = vintage ? parseInt(vintage, 10) : null;
    const trimmedRegion = region.trim() || null;
    const trimmedAiSummary = aiSummary.trim() || null;
    const trimmedAiGeography = aiGeography.trim() || null;
    const trimmedAiProduction = aiProduction.trim() || null;
    const trimmedAiTastingNotes = aiTastingNotes.trim() || null;
    const trimmedAiPairings = aiPairings.trim() || null;
    const isScannedEntry = !!pendingLabelPhotoUrl;

    setLoading(true);
    try {
      const { data, error } = await supabase.from("wines").insert({
        event_id: eventId,
        brought_by: memberId,
        producer: trimmedProducer,
        varietal: trimmedVarietal,
        vintage: parsedVintage,
        region: trimmedRegion,
        ai_summary: trimmedAiSummary,
        quantity: quantity,
        color: color,
        is_sparkling: isSparkling,
        label_photo_url: pendingLabelPhotoUrl || null,
        display_photo_url: isScannedEntry ? null : (pendingDisplayPhotoUrl || null),
        image_confidence_score: isScannedEntry ? null : pendingImageConfidenceScore,
        image_generation_status: isScannedEntry ? "pending" : pendingImageGenerationStatus,
        image_generation_metadata: isScannedEntry ? null : pendingImageGenerationMetadata,
        price_range: priceRange || null,
        price_cents: priceCentsValue,
        ai_geography: trimmedAiGeography,
        ai_production: trimmedAiProduction,
        ai_tasting_notes: trimmedAiTastingNotes,
        ai_pairings: trimmedAiPairings,
        wine_attributes: wineAttributes,
        drink_from: drinkFrom,
        drink_until: drinkUntil,
      }).select("id").single();
      if (error) {
        if (__DEV__) console.error("[add-wine] insert error:", JSON.stringify(error));
        throw error;
      }
      if (!data?.id) throw new Error("Wine was not saved. Please try again.");
      if (__DEV__) console.log("[add-wine] insert success, id:", data.id);

      await onSuccess();

      if (isScannedEntry && pendingLabelPhotoUrl) {
        enhanceBottleImageInBackground({
          wineId: data.id,
          memberId,
          eventId,
          rawImageUrl: pendingLabelPhotoUrl,
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

      const hasEnoughData = !!(trimmedProducer || trimmedVarietal || trimmedRegion);
      if (!isScannedEntry && hasEnoughData) {
        enrichWineInBackground({
          wineId: data.id,
          producer: trimmedProducer,
          varietal: trimmedVarietal,
          vintage: parsedVintage,
          region: trimmedRegion,
          color,
          isSparkling,
          queryClient,
        });
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : (e && typeof e === "object" && "message" in e)
            ? String((e as { message: unknown }).message)
            : "Could not add wine";
      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const isFormBlank =
    !producer.trim() && !varietal.trim() && !region.trim() && !aiSummary.trim();

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.scanButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={onScan}
      >
        <Text style={[styles.scanButtonText, { color: theme.primary }]}>Scan label</Text>
        <Text style={[styles.scanHint, { color: theme.textSecondary }]}>
          Use AI to fill fields from a photo
        </Text>
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
        <Text style={[styles.label, { color: theme.textSecondary }]}>Price range</Text>
        <TouchableOpacity
          style={[styles.input, styles.quantityTouchable, { borderColor: theme.border }]}
          onPress={() => setPriceRangeModalVisible(true)}
        >
          <Text style={{ color: theme.text, fontSize: 16 }}>
            {PRICE_RANGE_OPTIONS.find((o) => o.value === priceRange)?.label ?? "No range"}
          </Text>
        </TouchableOpacity>
        <Modal
          visible={priceRangeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPriceRangeModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setPriceRangeModalVisible(false)}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Price range</Text>
              {PRICE_RANGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.quantityOption,
                    priceRange === opt.value && { backgroundColor: theme.primary + "20" },
                  ]}
                  onPress={() => {
                    setPriceRange(opt.value);
                    setPriceRangeModalVisible(false);
                  }}
                >
                  <Text style={[styles.quantityOptionText, { color: theme.text }]}>{opt.label}</Text>
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
            {COLOR_OPTIONS.find((o) => o.value === color)?.label ?? "Not set"}
          </Text>
        </TouchableOpacity>
        <Modal
          visible={colorModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setColorModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setColorModalVisible(false)}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Color</Text>
              {COLOR_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.quantityOption,
                    color === opt.value && { backgroundColor: theme.primary + "20" },
                  ]}
                  onPress={() => {
                    setColor(opt.value);
                    setColorModalVisible(false);
                  }}
                >
                  <Text style={[styles.quantityOptionText, { color: theme.text }]}>{opt.label}</Text>
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
          <Text style={[styles.sparklingToggleText, { color: theme.text }]}>
            {isSparkling ? "Yes" : "No"}
          </Text>
          <View style={[styles.sparklingIndicator, isSparkling && { backgroundColor: theme.primary }]} />
        </TouchableOpacity>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Exact price (optional)</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          value={priceCents}
          onChangeText={setPriceCents}
          placeholder="e.g. 63 for $63"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Producer</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          value={producer}
          onChangeText={setProducer}
          placeholder="Producer name"
          placeholderTextColor={theme.textMuted}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Varietal</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          value={varietal}
          onChangeText={setVarietal}
          placeholder="e.g. Pinot Noir"
          placeholderTextColor={theme.textMuted}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Vintage</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          value={vintage}
          onChangeText={setVintage}
          placeholder="e.g. 2020"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Region</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          value={region}
          onChangeText={setRegion}
          placeholder="e.g. Burgundy"
          placeholderTextColor={theme.textMuted}
        />
        {aiSummary ? (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Background (from label)</Text>
            <TextInput
              style={[
                styles.input,
                styles.summaryInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              value={aiSummary}
              onChangeText={setAiSummary}
              placeholder="Optional summary"
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </>
        ) : null}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary, opacity: isFormBlank ? 0.5 : 1 },
          ]}
          onPress={submit}
          disabled={loading || isFormBlank}
        >
          <Text style={styles.buttonText}>{loading ? "Adding…" : submitButtonLabel}</Text>
        </TouchableOpacity>
        {isFormBlank ? (
          <Text style={[styles.hintBlank, { color: theme.textSecondary }]}>
            Enter at least producer, varietal, region, or background.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  scanButton: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  scanButtonText: { fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
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
  modalTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12, fontFamily: "PlayfairDisplay_600SemiBold" },
  quantityOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  quantityOptionText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
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
  sparklingToggleText: { fontSize: 16 },
  sparklingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5DDD6",
  },
});
