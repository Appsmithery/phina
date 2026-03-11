import { ScrollView, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { TabScreenHeader } from "@/components/layout/TabScreenHeader";
import { PAGE_HORIZONTAL_PADDING, getTabContentBottomPadding, useOptionalBottomTabBarHeight } from "@/lib/layout";
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
  const tabBarHeight = useOptionalBottomTabBarHeight();
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: getTabContentBottomPadding(tabBarHeight, 0) }]}
      showsVerticalScrollIndicator={false}
    >
      <TabScreenHeader
        title="Help Me Pick"
        left={<Ionicons name="search-outline" size={22} color={theme.primary} />}
      />

      <Text style={[styles.comingSoon, { color: theme.primary }]}>Coming Soon</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        AI-powered recommendations based on your taste profile.
      </Text>
      <Text style={[styles.premiumNote, { color: theme.textMuted }]}>
        Help Me Pick will be included with Premium.
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: PAGE_HORIZONTAL_PADDING },
  comingSoon: { fontSize: 13, fontFamily: "Montserrat_600SemiBold", letterSpacing: 1, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Montserrat_400Regular", lineHeight: 20, marginBottom: 24 },
  premiumNote: { fontSize: 13, fontFamily: "Montserrat_500Medium", lineHeight: 18, marginBottom: 20 },
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
