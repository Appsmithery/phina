import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, Image } from "react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Wine } from "@/types/database";

export default function WineDetailScreen() {
  const { wineId } = useLocalSearchParams<{ id: string; wineId: string }>();
  const theme = useTheme();

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as Wine;
    },
    enabled: !!wineId,
  });

  if (!wine) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {isLoading ? "Loading…" : "Wine not found."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {wine.label_photo_url ? (
        <Image
          source={{ uri: wine.label_photo_url }}
          style={styles.photo}
          resizeMode="contain"
        />
      ) : null}
      <Text style={[styles.producer, { color: theme.text }]}>{wine.producer ?? "Unknown producer"}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {[wine.varietal, wine.vintage?.toString(), wine.region].filter(Boolean).join(" · ")}
      </Text>
      {wine.ai_summary ? (
        <Text style={[styles.summary, { color: theme.text }]}>{wine.ai_summary}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  photo: { width: "100%", height: 200, borderRadius: 14, marginBottom: 16 },
  producer: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  meta: { fontSize: 16, marginBottom: 16 },
  summary: { fontSize: 15, lineHeight: 22 },
  placeholder: { padding: 24 },
});
