import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/lib/theme";

type ProfileEmptyStateProps = {
  theme: ReturnType<typeof useTheme>;
  onCtaPress: () => void;
};

const PLACEHOLDER_ROWS = ["Body", "Dryness", "Palette"] as const;

export function ProfileEmptyState({ theme, onCtaPress }: ProfileEmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="wine-outline" size={48} color={theme.textMuted} />
      <Text style={[styles.headline, { color: theme.text }]}>Your taste profile starts here.</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Rate your first wine. Once you start logging your impressions, your personal Taste Graph will appear here:
        body, dryness, palette, and your preferred notes, all built from your own data.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {PLACEHOLDER_ROWS.map((label) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { backgroundColor: theme.textMuted + "35" }]} />
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={onCtaPress}
      >
        <Text style={styles.buttonText}>Browse Events</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 24,
  },
  headline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    marginTop: 12,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 16,
    padding: 16,
  },
  row: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  track: {
    borderRadius: 2,
    height: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    width: "50%",
  },
  button: {
    alignSelf: "stretch",
    borderRadius: 12,
    padding: 14,
  },
  buttonText: {
    color: "#fff",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
  },
});
