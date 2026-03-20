import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { getEventInviteDetails } from "@/lib/event-invite";
import { useTheme } from "@/lib/theme";

export default function EventQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const inviteDetails = id
    ? getEventInviteDetails(id)
    : { url: "", isPreviewNativeInvite: false };
  const joinUrl = inviteDetails.url;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Scan to join</Text>
        <Text style={[styles.url, { color: theme.textSecondary }]}>{joinUrl}</Text>
        {joinUrl ? (
          <View style={[styles.qrWrap, { backgroundColor: theme.surface }]}>
            <QRCode value={joinUrl} size={260} />
          </View>
        ) : null}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {inviteDetails.isPreviewNativeInvite
            ? "Works with the installed Phina preview app."
            : "Members scan this QR code at the venue to join the event."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  url: { fontSize: 12, marginBottom: 24, textAlign: "center" },
  qrWrap: { padding: 24, borderRadius: 16, marginBottom: 24 },
  hint: { fontSize: 14, textAlign: "center" },
});
