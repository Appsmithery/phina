import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";

export default function HistoryScreen() {
  const theme = useTheme();

  const { data: events = [] } = useQuery({
    queryKey: ["events", "ended"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "ended")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>History</Text>
      {events.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Past events will appear here after hosts end them.
        </Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push(`/event/${item.id}`)}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                {item.theme} · {new Date(item.date).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", padding: 16 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  cardMeta: { fontSize: 14 },
  placeholder: { padding: 24, textAlign: "center" },
});
