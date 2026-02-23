import { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { setLastLabelExtraction } from "@/lib/last-label-extraction";

export default function ScanLabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [extracting, setExtracting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const captureAndExtract = async () => {
    if (!id) {
      Alert.alert("Error", "Event not found.");
      return;
    }
    if (!cameraRef.current) {
      Alert.alert("Camera not ready", "Please wait a moment and try again.");
      return;
    }
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Camera access", "Camera permission is needed to scan the label.");
        return;
      }
    }
    setExtracting(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      if (!photo?.base64) {
        Alert.alert("Error", "Could not capture image.");
        return;
      }
      const imagePayload = `data:image/jpeg;base64,${photo.base64}`;
      const { data, error } = await supabase.functions.invoke("extract-wine-label", {
        body: { image: imagePayload },
      });
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      if (err) {
        Alert.alert("Extraction failed", err);
        return;
      }
      const extracted = data as {
        producer?: string | null;
        varietal?: string | null;
        vintage?: number | null;
        region?: string | null;
        ai_summary?: string | null;
      };
      setLastLabelExtraction({
        producer: extracted.producer ?? null,
        varietal: extracted.varietal ?? null,
        vintage: extracted.vintage ?? null,
        region: extracted.region ?? null,
        ai_summary: extracted.ai_summary ?? null,
      });
      router.replace(`/event/${id}/add-wine`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Label extraction failed.";
      console.warn("Scan label error:", e);
      Alert.alert("Error", message);
    } finally {
      setExtracting(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.msg, { color: theme.text }]}>Checking camera…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.msg, { color: theme.text }]}>Camera access is needed to scan the label.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} pointerEvents="none" />
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Frame the wine label in the viewfinder</Text>
        <TouchableOpacity
          style={[styles.captureBtn, { backgroundColor: theme.primary }]}
          onPress={captureAndExtract}
          disabled={extracting}
        >
          {extracting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.captureBtnText}>{extracting ? "Extracting…" : "Scan label"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  msg: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  button: { borderRadius: 12, padding: 14, paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontWeight: "600" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 40, alignItems: "center" },
  hint: { fontSize: 14, marginBottom: 16 },
  captureBtn: { borderRadius: 12, padding: 16, paddingHorizontal: 32, minWidth: 160, alignItems: "center" },
  captureBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
