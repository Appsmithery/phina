import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";

type EventsTab = "upcoming" | "past" | "my-events";

const TAB_LABELS: Record<EventsTab, string> = {
  upcoming: "Upcoming",
  past: "Past",
  "my-events": "My Events",
};

export default function EventsScreen() {
  const theme = useTheme();
  const { member } = useSupabase();
  const [activeTab, setActiveTab] = useState<EventsTab>("upcoming");
  const [search, setSearch] = useState("");

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

  const { data: myEventIds = new Set<string>() } = useQuery({
    queryKey: ["events", "my-memberships", member?.id],
    queryFn: async () => {
      if (!member?.id) return new Set<string>();
      const { data, error } = await supabase
        .from("event_members")
        .select("event_id")
        .eq("member_id", member.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.event_id));
    },
    enabled: !!member?.id,
  });

  const filteredEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = search.trim().toLowerCase();

    let filtered: Event[];
    switch (activeTab) {
      case "upcoming":
        filtered = events
          .filter((e) => e.date >= today && e.status !== "ended")
          .sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "past":
        filtered = events.filter((e) => e.date < today || e.status === "ended");
        break;
      case "my-events":
        filtered = events.filter(
          (e) => myEventIds.has(e.id) || e.created_by === member?.id,
        );
        break;
    }

    if (q) {
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.theme.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [events, activeTab, myEventIds, member?.id, search]);

  const emptyMessage = useMemo(() => {
    if (search.trim()) return "No events match your search.";
    switch (activeTab) {
      case "upcoming":
        return "No upcoming events. Host one to get started.";
      case "past":
        return "No past events yet.";
      case "my-events":
        return "You haven't joined any events yet.";
    }
  }, [activeTab, search]);

  const renderItem = ({ item }: { item: Event }) => {
    const d = new Date(item.date + "T00:00:00");
    const dayNum = d.getDate();
    const monthAbbr = d
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase();

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={() => router.push(`/event/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardRow}>
          <View style={[styles.dateBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.dateBadgeDay}>{dayNum}</Text>
            <Text style={styles.dateBadgeMonth}>{monthAbbr}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.cardTheme, { color: theme.textSecondary }]}>
              {item.theme}
            </Text>
            <View
              style={[
                styles.badge,
                item.status === "ended"
                  ? { backgroundColor: theme.textMuted }
                  : { backgroundColor: theme.primary },
              ]}
            >
              <Text style={styles.badgeText}>
                {item.status === "ended" ? "Ended" : "Active"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Events</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/event/create")}
        >
          <Text style={styles.createButtonText}>Host</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(["upcoming", "past", "my-events"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && {
                borderBottomColor: theme.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab ? theme.primary : theme.textMuted,
                },
              ]}
            >
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={[
          styles.searchWrapper,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={16}
          color={theme.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.search, { color: theme.text }]}
          placeholder="Find workshops, galas, or mixers…"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading…
        </Text>
      ) : filteredEvents.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {emptyMessage}
        </Text>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            activeTab === "upcoming" ? (
              <Text
                style={[styles.sectionHeader, { color: theme.text }]}
              >
                Recommended for you
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 12,
  },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cardRow: { flexDirection: "row", gap: 12 },
  dateBadge: {
    width: 52,
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateBadgeDay: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
    lineHeight: 26,
  },
  dateBadgeMonth: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.5,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
    fontFamily: "PlayfairDisplay_600SemiBold",
  },
  cardTheme: {
    fontSize: 13,
    marginBottom: 8,
    fontFamily: "Montserrat_400Regular",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  placeholder: {
    padding: 24,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
});
