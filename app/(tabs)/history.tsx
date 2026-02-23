import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";

export default function HistoryScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.theme.toLowerCase().includes(q) ||
        new Date(e.date).toLocaleDateString().toLowerCase().includes(q)
    );
  }, [events, search]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Library</Text>
      <TextInput
        style={[styles.search, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        placeholder="Search by title, theme, or date…"
        placeholderTextColor={theme.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      {filtered.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {events.length === 0
            ? "Past events will appear here after hosts end them."
            : "No events match your search."}
        </Text>
      ) : (
        <FlatList
          data={filtered}
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
  search: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
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
