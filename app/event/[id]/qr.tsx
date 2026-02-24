import { useLocalSearchParams, router } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "@/lib/theme";

const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

export default function EventQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const joinUrl = id ? `${APP_BASE_URL}/join/${id}` : "";

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
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Scan to join</Text>
        <Text style={[styles.url, { color: theme.textSecondary }]}>{joinUrl}</Text>
        {joinUrl ? (
          <View style={[styles.qrWrap, { backgroundColor: theme.surface }]}>
            <QRCode value={joinUrl} size={260} />
          </View>
        ) : null}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Members scan this QR code at the venue to join the event.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  backRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backText: { fontSize: 16, fontWeight: "600", marginLeft: 4 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  url: { fontSize: 12, marginBottom: 24, textAlign: "center" },
  qrWrap: { padding: 24, borderRadius: 16, marginBottom: 24 },
  hint: { fontSize: 14, textAlign: "center" },
});
