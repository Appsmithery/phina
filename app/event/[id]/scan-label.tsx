import { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { setLastLabelExtraction } from "@/lib/last-label-extraction";

async function getEdgeFunctionErrorMessage(error: unknown, data: unknown): Promise<string> {
  const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const errMsg = dataObj?.error;
  if (typeof errMsg === "string" && errMsg.trim()) return errMsg;

  const err = error as {
    message?: string;
    context?: {
      status?: number;
      body?: string;
      json?: () => Promise<{ error?: string; message?: string }>;
    };
  } | null;
  const status = err?.context?.status;
  if (status === 401) {
    return "Sign-in or project configuration issue. Check that you're signed in and that the app's Supabase URL and key match the project that hosts the Edge Function.";
  }
  if (err?.context) {
    try {
      let parsed: { error?: string; message?: string } | null = null;
      if (typeof (err.context as { json?: () => Promise<unknown> }).json === "function") {
        parsed = (await (err.context as { json: () => Promise<{ error?: string; message?: string }> }).json()) ?? null;
      } else if (typeof (err.context as { body?: string }).body === "string") {
        parsed = JSON.parse((err.context as { body: string }).body) as { error?: string; message?: string };
      }
      if (parsed) {
        if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
        if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
      }
    } catch {
      // ignore parse failure
    }
  }
  if (err?.message && !err.message.includes("non-2xx")) return err.message;
  return "Label extraction failed. Check that the Edge Function is deployed and PERPLEXITY_API_KEY is set.";
}

export default function ScanLabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [extracting, setExtracting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const captureAndExtract = async () => {
    if (__DEV__) {
      console.log("[scan-label] captureAndExtract called", {
        id,
        hasRef: !!cameraRef.current,
        permissionGranted: permission?.granted,
      });
    }
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
    if (__DEV__) {
      console.log("[scan-label] guards passed, calling takePictureAsync");
    }
    setExtracting(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      if (__DEV__) {
        console.log("[scan-label] takePictureAsync resolved", {
          hasPhoto: !!photo,
          hasBase64: !!photo?.base64,
        });
      }
      if (!photo?.base64) {
        Alert.alert("Error", "Could not capture image.");
        return;
      }
      const imagePayload = `data:image/jpeg;base64,${photo.base64}`;
      const { data, error } = await supabase.functions.invoke("extract-wine-label", {
        body: { image: imagePayload },
      });
      if (__DEV__) {
        console.log("[scan-label] extract-wine-label invoke result", { data, error, context: (error as { context?: unknown })?.context });
      }
      const err = (data as { error?: string })?.error;
      if (err) {
        Alert.alert("Extraction failed", err);
        return;
      }
      if (error) {
        const message = await getEdgeFunctionErrorMessage(error, data);
        Alert.alert("Label extraction failed", message);
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
      console.warn("[scan-label] captureAndExtract error", e);
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
      <CameraView
        style={StyleSheet.absoluteFill}
        ref={cameraRef}
        pointerEvents="none"
        onCameraReady={() => {
          if (__DEV__) {
            console.log("[scan-label] onCameraReady fired");
          }
          setCameraReady(true);
        }}
      />
      <View
        style={[
          styles.footer,
          { zIndex: 10 },
          Platform.OS === "android" && { elevation: 10 },
        ]}
      >
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {cameraReady
            ? "Frame the wine label in the viewfinder"
            : "Preparing camera…"}
        </Text>
        <TouchableOpacity
          style={[
            styles.captureBtn,
            { backgroundColor: theme.primary, opacity: cameraReady && !extracting ? 1 : 0.6 },
          ]}
          onPress={captureAndExtract}
          disabled={extracting || !cameraReady}
        >
          {extracting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.captureBtnText}>
              {!cameraReady ? "Preparing…" : "Scan label"}
            </Text>
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
