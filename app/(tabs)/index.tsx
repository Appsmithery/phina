import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Image, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { TabScreenHeader } from "@/components/layout/TabScreenHeader";
import { PAGE_HORIZONTAL_PADDING, getTabContentBottomPadding, useOptionalBottomTabBarHeight } from "@/lib/layout";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";
import { useBilling } from "@/hooks/use-billing";

type EventsTab = "upcoming" | "past" | "my-events";

const TAB_LABELS: Record<EventsTab, string> = {
  upcoming: "Upcoming",
  past: "Past",
  "my-events": "My Events",
};

export default function EventsScreen() {
  const theme = useTheme();
  const { member } = useSupabase();
  const { hostCreditBalance, hasAdminBillingBypass, billingAccessLabel } = useBilling();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const [activeTab, setActiveTab] = useState<EventsTab>("upcoming");
  const [search, setSearch] = useState("");

  const { data: events = [], isLoading, isError, error: eventsError } = useQuery({
    queryKey: ["events", member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      if (__DEV__) console.log("[events] Fetching events for member", member?.id);
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
      if (__DEV__) console.log("[events] Result:", { count: data?.length ?? 0, error: error?.message ?? null });
      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: myEventIds = new Set<string>() } = useQuery({
    queryKey: ["events", "my-memberships", member?.id],
    queryFn: async () => {
      if (!member?.id) return new Set<string>();
      const { data, error } = await supabase.from("event_members").select("event_id").eq("member_id", member.id);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.event_id));
    },
    enabled: !!member?.id,
  });

  const filteredEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const query = search.trim().toLowerCase();

    let filtered: Event[];
    switch (activeTab) {
      case "upcoming":
        filtered = events.filter((event) => event.date >= today && event.status !== "ended").sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "past":
        filtered = events.filter((event) => event.date < today || event.status === "ended");
        break;
      case "my-events":
        filtered = events.filter((event) => myEventIds.has(event.id) || event.created_by === member?.id);
        break;
    }

    if (query) {
      filtered = filtered.filter((event) => {
        return event.title.toLowerCase().includes(query) || event.theme.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [activeTab, events, member?.id, myEventIds, search]);

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
    const date = new Date(`${item.date}T00:00:00`);
    const dayNum = date.getDate();
    const monthAbbr = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const dateLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.surface }]}
        onPress={() => router.push(`/event/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.heroShell, { backgroundColor: `${theme.primary}12` }]}>
          {item.event_image_url ? (
            <Image source={{ uri: item.event_image_url }} style={styles.heroImage} resizeMode="cover" />
          ) : null}

          <View style={styles.heroOverlay} pointerEvents="none">
            <View style={[styles.dateBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.dateBadgeDay}>{dayNum}</Text>
              <Text style={styles.dateBadgeMonth}>{monthAbbr}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                item.status === "ended"
                  ? { backgroundColor: "rgba(0,0,0,0.55)" }
                  : { backgroundColor: "rgba(181, 90, 90, 0.9)" },
              ]}
            >
              <Text style={styles.statusBadgeText}>{item.status === "ended" ? "Ended" : "Active"}</Text>
            </View>
          </View>

          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTheme, { color: theme.text }]}>{item.theme}</Text>
          <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{dateLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TabScreenHeader
        title="Events"
        left={
          <TouchableOpacity
            style={[styles.creditChip, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() =>
              Alert.alert(
                hasAdminBillingBypass ? "Admin override" : "Host credits",
                hasAdminBillingBypass
                  ? "This admin account can host events without purchasing or consuming host credits."
                  : `You currently have ${hostCreditBalance} host credit${hostCreditBalance === 1 ? "" : "s"}. Buy more from your profile any time.`
              )
            }
            hitSlop={8}
          >
            <Ionicons
              name={hasAdminBillingBypass ? "shield-checkmark-outline" : "ticket-outline"}
              size={16}
              color={theme.primary}
            />
            <Text style={[styles.creditChipText, { color: theme.text }]}>
              {hasAdminBillingBypass ? (billingAccessLabel ?? "Admin") : hostCreditBalance}
            </Text>
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/event/create")}
          >
            <Text style={styles.createButtonText}>Host</Text>
          </TouchableOpacity>
        }
      />

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
            <Text style={[styles.tabText, { color: activeTab === tab ? theme.primary : theme.textMuted }]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.searchWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.search, { color: theme.text }]}
          placeholder="Find tastings, dinners, or group pours..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading...</Text>
      ) : isError ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {"Failed to load events" + (eventsError instanceof Error ? `: ${eventsError.message}` : "")}
        </Text>
      ) : filteredEvents.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>{emptyMessage}</Text>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: getTabContentBottomPadding(tabBarHeight, 0) }]}
          ListHeaderComponent={
            activeTab === "upcoming" ? (
              <Text style={[styles.sectionHeader, { color: theme.text }]}>Recommended for you</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  creditChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  creditChipText: {
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
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
  tabRow: { flexDirection: "row", marginHorizontal: PAGE_HORIZONTAL_PADDING, marginBottom: 12 },
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
    marginHorizontal: PAGE_HORIZONTAL_PADDING,
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
  list: { padding: PAGE_HORIZONTAL_PADDING, paddingTop: 0 },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroShell: {
    position: "relative",
    minHeight: 208,
    justifyContent: "space-between",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 12,
  },
  dateBadge: {
    width: 56,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
  },
  titleWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 36,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
  },
  cardTheme: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
  },
  placeholder: {
    padding: 24,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
});
