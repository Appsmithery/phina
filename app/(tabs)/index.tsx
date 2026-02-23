import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";

export default function EventsScreen() {
  const theme = useTheme();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });

  const renderItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => router.push(`/event/${item.id}`)}
      activeOpacity={0.8}
    >
      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
        {item.theme} · {new Date(item.date).toLocaleDateString()}
      </Text>
      <View style={[styles.badge, item.status === "ended" ? { backgroundColor: theme.textMuted } : { backgroundColor: theme.primary }]}>
        <Text style={styles.badgeText}>{item.status === "ended" ? "Ended" : "Active"}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Events</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/event/create")}
        >
          <Text style={styles.createButtonText}>New event</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      ) : events.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          No events yet. Create one to get started.
        </Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  createButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  createButtonText: { color: "#fff", fontWeight: "600" },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  cardMeta: { fontSize: 14, marginBottom: 8 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  placeholder: { padding: 24, textAlign: "center" },
});
