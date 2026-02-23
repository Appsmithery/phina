import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

export default function EventQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const joinUrl = id ? `${APP_BASE_URL}/join/${id}` : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  url: { fontSize: 12, marginBottom: 24, textAlign: "center" },
  qrWrap: { padding: 24, borderRadius: 16, marginBottom: 24 },
  hint: { fontSize: 14, textAlign: "center" },
});
