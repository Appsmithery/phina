import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { setLastLabelExtraction } from "@/lib/last-label-extraction";

// expo-camera is native-only; skip import on web to avoid bundler errors
type CameraViewType = import("expo-camera").CameraView;
let CameraView: typeof import("expo-camera").CameraView | undefined;
let useCameraPermissions: typeof import("expo-camera").useCameraPermissions | undefined;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cam = require("expo-camera") as typeof import("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

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
        parsed =
          (await (err.context as { json: () => Promise<{ error?: string; message?: string }> }).json()) ?? null;
      } else if (typeof (err.context as { body?: string }).body === "string") {
        parsed = JSON.parse((err.context as { body: string }).body) as {
          error?: string;
          message?: string;
        };
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

type ExtractionResult = {
  producer?: string | null;
  varietal?: string | null;
  vintage?: number | null;
  region?: string | null;
  ai_summary?: string | null;
  label_photo_url?: string | null;
  color?: "red" | "white" | "skin-contact" | null;
  is_sparkling?: boolean | null;
  ai_overview?: string | null;
  ai_geography?: string | null;
  ai_production?: string | null;
  ai_tasting_notes?: string | null;
  ai_pairings?: string | null;
  drink_from?: number | null;
  drink_until?: number | null;
};

async function extractLabel(imagePayload: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("extract-wine-label", {
    body: { image: imagePayload },
  });
  const err = (data as { error?: string })?.error;
  if (err) throw new Error(err);
  if (error) {
    const message = await getEdgeFunctionErrorMessage(error, data);
    throw new Error(message);
  }
  const extracted = data as ExtractionResult;
  const color = extracted.color ?? null;
  setLastLabelExtraction({
    producer: extracted.producer ?? null,
    varietal: extracted.varietal ?? null,
    vintage: extracted.vintage ?? null,
    region: extracted.region ?? null,
    ai_summary: extracted.ai_summary ?? null,
    label_photo_url: extracted.label_photo_url ?? null,
    color: color === "red" || color === "white" || color === "skin-contact" ? color : null,
    is_sparkling: extracted.is_sparkling ?? null,
    ai_overview: extracted.ai_overview ?? null,
    ai_geography: extracted.ai_geography ?? null,
    ai_production: extracted.ai_production ?? null,
    ai_tasting_notes: extracted.ai_tasting_notes ?? null,
    ai_pairings: extracted.ai_pairings ?? null,
    drink_from: extracted.drink_from ?? null,
    drink_until: extracted.drink_until ?? null,
  });
  router.back();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SharedScanLabelScreen() {
  const theme = useTheme();
  const [extracting, setExtracting] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);

  // ── Web-specific: file upload fallback ──
  if (Platform.OS === "web") {
    return <WebScanLabel theme={theme} extracting={extracting} setExtracting={setExtracting} />;
  }

  // ── Native: camera-based scanning ──
  return (
    <NativeScanLabel
      theme={theme}
      extracting={extracting}
      setExtracting={setExtracting}
      photoCaptured={photoCaptured}
      setPhotoCaptured={setPhotoCaptured}
    />
  );
}

function WebScanLabel({
  theme,
  extracting,
  setExtracting,
}: {
  theme: ReturnType<typeof useTheme>;
  extracting: boolean;
  setExtracting: (v: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setExtracting(true);
      try {
        const dataUrl = await fileToBase64(file);
        await extractLabel(dataUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Label extraction failed.";
        showAlert("Error", message);
      } finally {
        setExtracting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [setExtracting]
  );

  if (extracting) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
        <Text style={[styles.analyzingTitle, { color: theme.text }]}>Analyzing label…</Text>
        <Text style={[styles.analyzingHint, { color: theme.textSecondary }]}>
          This may take a few seconds
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.analyzingTitle, { color: theme.text }]}>Scan wine label</Text>
      <Text style={[styles.analyzingHint, { color: theme.textSecondary, marginBottom: 24 }]}>
        Upload a photo of a wine label to extract its details
      </Text>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
        style={{ display: "none" }}
      />
      <TouchableOpacity
        style={[styles.captureBtn, { backgroundColor: theme.primary }]}
        onPress={() => fileInputRef.current?.click()}
        disabled={extracting}
      >
        <Text style={styles.captureBtnText}>Choose photo</Text>
      </TouchableOpacity>
    </View>
  );
}

function NativeScanLabel({
  theme,
  extracting,
  setExtracting,
  photoCaptured,
  setPhotoCaptured,
}: {
  theme: ReturnType<typeof useTheme>;
  extracting: boolean;
  setExtracting: (v: boolean) => void;
  photoCaptured: boolean;
  setPhotoCaptured: (v: boolean) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions!();
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraViewType | null>(null);

  // NOTE: do not use router.replace() here — it duplicates the add-wine screen in the
  // navigation stack. router.back() returns to the exact add-wine instance that pushed
  // this screen, and AddWineForm's useFocusEffect reads the extraction on focus.

  const captureAndExtract = async () => {
    if (!cameraRef.current) {
      showAlert("Camera not ready", "Please wait a moment and try again.");
      return;
    }
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        showAlert("Camera access", "Camera permission is needed to scan the label.");
        return;
      }
    }
    setExtracting(true);
    try {
      const photo = await (cameraRef.current as CameraViewType).takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      if (!photo?.base64) {
        showAlert("Error", "Could not capture image.");
        return;
      }

      // Photo captured successfully — close camera, show loading screen
      setPhotoCaptured(true);

      const imagePayload = `data:image/jpeg;base64,${photo.base64}`;
      await extractLabel(imagePayload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Label extraction failed.";
      setPhotoCaptured(false);
      showAlert("Error", message);
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

  if (photoCaptured && extracting) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
        <Text style={[styles.analyzingTitle, { color: theme.text }]}>Analyzing label…</Text>
        <Text style={[styles.analyzingHint, { color: theme.textSecondary }]}>
          This may take a few seconds
        </Text>
      </View>
    );
  }

  const CameraViewComponent = CameraView!;
  return (
    <View style={styles.container}>
      <CameraViewComponent
        style={StyleSheet.absoluteFill}
        ref={cameraRef as React.RefObject<CameraViewType>}
        pointerEvents="none"
        onCameraReady={() => setCameraReady(true)}
      />
      <View
        style={[
          styles.footer,
          { zIndex: 10 },
          Platform.OS === "android" && { elevation: 10 },
        ]}
      >
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {cameraReady ? "Frame the wine label in the viewfinder" : "Preparing camera…"}
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
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  hint: { fontSize: 14, marginBottom: 16 },
  captureBtn: {
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
    minWidth: 160,
    alignItems: "center",
  },
  captureBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  spinner: { marginBottom: 20 },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    fontFamily: "PlayfairDisplay_600SemiBold",
  },
  analyzingHint: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
  },
});
