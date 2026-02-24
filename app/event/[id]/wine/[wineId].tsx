import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Wine } from "@/types/database";
import type { Event } from "@/types/database";

export default function WineDetailScreen() {
  const { id: eventId, wineId } = useLocalSearchParams<{ id: string; wineId: string }>();
  const theme = useTheme();
  const { member } = useSupabase();
  const queryClient = useQueryClient();

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine", wineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", wineId!).single();
      if (error) throw error;
      return data as Wine;
    },
    enabled: !!wineId,
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId && !!wine?.event_id,
  });

  const canRemove = Boolean(
    wine &&
      eventId &&
      (member?.id === wine.brought_by || event?.created_by === member?.id)
  );

  const handleRemove = () => {
    if (!wine?.id || !eventId) return;
    Alert.alert(
      "Remove from event",
      "Remove this wine from the event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("wines").delete().eq("id", wine.id);
            if (error) {
              Alert.alert("Error", error.message ?? "Could not remove wine.");
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["wines", eventId] });
            queryClient.invalidateQueries({ queryKey: ["wine", wineId] });
            router.back();
          },
        },
      ]
    );
  };

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
      {(wine.quantity != null && wine.quantity >= 1) && (
        <Text style={[styles.quantityText, { color: theme.textSecondary }]}>Quantity: {wine.quantity}</Text>
      )}
      {wine.ai_summary ? (
        <Text style={[styles.summary, { color: theme.text }]}>{wine.ai_summary}</Text>
      ) : null}
      {canRemove && (
        <TouchableOpacity
          style={[styles.removeButton, { borderColor: theme.textMuted }]}
          onPress={handleRemove}
        >
          <Text style={[styles.removeButtonText, { color: theme.textMuted }]}>Remove from event</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  photo: { width: "100%", height: 200, borderRadius: 14, marginBottom: 16 },
  producer: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  meta: { fontSize: 16, marginBottom: 8 },
  quantityText: { fontSize: 14, marginBottom: 16 },
  summary: { fontSize: 15, lineHeight: 22 },
  removeButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 24 },
  removeButtonText: { fontSize: 16, fontWeight: "500" },
  placeholder: { padding: 24 },
});
