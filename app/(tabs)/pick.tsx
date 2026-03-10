import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const FEATURES = [
  {
    icon: "storefront-outline" as const,
    title: "Wine Shop",
    description: "Photograph bottles on a shelf and get ranked picks matched to your taste.",
  },
  {
    icon: "restaurant-outline" as const,
    title: "Restaurant",
    description: "Photograph a wine list and get suggestions for your meal and budget.",
  },
  {
    icon: "chatbubble-ellipses-outline" as const,
    title: "Cooking",
    description: "Describe a recipe or meal and get pairing recommendations via chat.",
  },
];

export default function PickScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <Ionicons name="search-outline" size={22} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Help Me Pick</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={[styles.comingSoon, { color: theme.primary }]}>Coming Soon</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        AI-powered recommendations based on your taste profile.
      </Text>

      {FEATURES.map((f) => (
        <View key={f.title} style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name={f.icon} size={24} color={theme.primary} style={styles.featureIcon} />
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
            <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>{f.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 0,
  },
  title: { fontSize: 20, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  comingSoon: { fontSize: 13, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Montserrat_400Regular", lineHeight: 20, marginBottom: 24 },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  featureIcon: { marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontFamily: "Montserrat_600SemiBold", marginBottom: 4 },
  featureDesc: { fontSize: 13, fontFamily: "Montserrat_400Regular", lineHeight: 18 },
});
